import fs from 'node:fs';
import path from 'node:path';
import { RunResult } from './runner.js';

export interface CellSummary {
    scenario: string;
    journalMode: string;
    concurrency: number;
    useLock: boolean;
    repeats: number;
    iterations: number;
    meanWallMs: number;
    stddevWallMs: number;
    meanThroughput: number;
    p50: number;
    p95: number;
    p99: number;
    meanLatency: number;
    totalErrors: number;
    totalBusyErrors: number;
}

const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx]!;
};

const mean = (xs: number[]): number => xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const stddev = (xs: number[]): number => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1));
};

export const summarizeCell = (
    scenario: string,
    journalMode: string,
    concurrency: number,
    useLock: boolean,
    iterations: number,
    runs: RunResult[],
): CellSummary => {
    const allLatencies: number[] = [];
    for (const r of runs) {
        for (const l of r.latenciesMs) allLatencies.push(l);
    }
    allLatencies.sort((a, b) => a - b);

    const wallTimes = runs.map(r => r.wallTimeMs);
    const throughputs = runs.map(r => (r.iterations - r.errorCount) / (r.wallTimeMs / 1000));

    return {
        scenario,
        journalMode,
        concurrency,
        useLock,
        repeats:         runs.length,
        iterations,
        meanWallMs:      mean(wallTimes),
        stddevWallMs:    stddev(wallTimes),
        meanThroughput:  mean(throughputs),
        p50:             percentile(allLatencies, 50),
        p95:             percentile(allLatencies, 95),
        p99:             percentile(allLatencies, 99),
        meanLatency:     mean(allLatencies),
        totalErrors:     runs.reduce((sum, r) => sum + r.errorCount, 0),
        totalBusyErrors: runs.reduce((sum, r) => sum + r.busyErrorCount, 0),
    };
};

const fmt = (n: number, digits = 2): string => Number.isFinite(n) ? n.toFixed(digits) : '—';

export const renderMarkdown = (
    summaries: CellSummary[],
    pragmasByMode: Record<string, Record<string, unknown>>,
): string => {
    const lines: string[] = [];
    lines.push('# Prisma + SQLite Concurrency Benchmark');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## SQLite pragmas (on benchmark DB copy)');
    lines.push('');
    for (const [mode, pragmas] of Object.entries(pragmasByMode)) {
        lines.push(`### Journal mode: ${mode}`);
        lines.push('');
        lines.push('| Pragma | Value |');
        lines.push('|---|---|');
        for (const [k, v] of Object.entries(pragmas)) {
            const display = typeof v === 'bigint' ? v.toString() : JSON.stringify(v);
            lines.push(`| \`${k}\` | \`${display}\` |`);
        }
        lines.push('');
    }

    const groupKeys = Array.from(new Set(summaries.map(s => `${s.scenario}@${s.journalMode}`)));
    for (const key of groupKeys) {
        const [scenario, journalMode] = key.split('@');
        const rows = summaries.filter(s => s.scenario === scenario && s.journalMode === journalMode);
        lines.push(`## Scenario: ${scenario} (journal_mode=${journalMode})`);
        lines.push('');
        lines.push('| Lock | Concurrency | Iter/run | Repeats | Wall ms (mean ± σ) | Throughput (ops/s) | p50 ms | p95 ms | p99 ms | Errors | SQLITE_BUSY |');
        lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

        rows.sort((a, b) => (Number(b.useLock) - Number(a.useLock)) || (a.concurrency - b.concurrency));

        const baseline = rows.find(r => r.useLock && r.concurrency === 1);
        const baselineThroughput = baseline?.meanThroughput ?? 0;

        for (const r of rows) {
            const speedup = baselineThroughput > 0
                ? `${fmt(r.meanThroughput / baselineThroughput, 2)}×`
                : '—';
            lines.push([
                '',
                r.useLock ? 'on' : 'off',
                r.concurrency,
                r.iterations,
                r.repeats,
                `${fmt(r.meanWallMs)} ± ${fmt(r.stddevWallMs)}`,
                `${fmt(r.meanThroughput)} (${speedup} vs baseline)`,
                fmt(r.p50, 3),
                fmt(r.p95, 3),
                fmt(r.p99, 3),
                r.totalErrors,
                r.totalBusyErrors,
                '',
            ].join('|'));
        }
        lines.push('');

        const best = rows
            .filter(r => !r.useLock)
            .sort((a, b) => b.meanThroughput - a.meanThroughput)[0];
        if (best && baselineThroughput > 0) {
            const ratio = best.meanThroughput / baselineThroughput;
            const verdict = ratio >= 1.05 ? 'FASTER'
                : ratio <= 0.95 ? 'SLOWER'
                    : 'WASH';
            lines.push(`**Headline:** parallel-unlocked@${best.concurrency} is **${verdict}** at ${fmt(ratio, 2)}× the throughput of serial-locked baseline.`);
            lines.push('');
        }
    }

    // Cross-mode comparison: best unlocked throughput per (scenario, mode)
    const scenarios = Array.from(new Set(summaries.map(s => s.scenario)));
    const modes = Array.from(new Set(summaries.map(s => s.journalMode)));
    if (modes.length > 1) {
        lines.push('## Cross-journal-mode comparison (best unlocked throughput per scenario)');
        lines.push('');
        lines.push(`| Scenario | ${modes.map(m => `${m} ops/s (best c)`).join(' | ')} |`);
        lines.push(`|---|${modes.map(() => '---:').join('|')}|`);
        for (const scenario of scenarios) {
            const cells = modes.map(mode => {
                const best = summaries
                    .filter(s => s.scenario === scenario && s.journalMode === mode && !s.useLock)
                    .sort((a, b) => b.meanThroughput - a.meanThroughput)[0];
                return best == null ? '—' : `${fmt(best.meanThroughput)} (c=${best.concurrency})`;
            });
            lines.push(`| ${scenario} | ${cells.join(' | ')} |`);
        }
        lines.push('');
    }

    return lines.join('\n');
};

export const renderCsv = (summaries: CellSummary[]): string => {
    const header = ['scenario', 'journal_mode', 'use_lock', 'concurrency', 'iterations', 'repeats', 'mean_wall_ms', 'stddev_wall_ms', 'mean_throughput_ops_s', 'p50_ms', 'p95_ms', 'p99_ms', 'mean_latency_ms', 'errors', 'busy_errors'];
    const rows = summaries.map(s => [
        s.scenario, s.journalMode, s.useLock, s.concurrency, s.iterations, s.repeats,
        s.meanWallMs, s.stddevWallMs, s.meanThroughput,
        s.p50, s.p95, s.p99, s.meanLatency, s.totalErrors, s.totalBusyErrors,
    ].join(','));
    return [header.join(','), ...rows].join('\n');
};

export const writeResults = (
    outDir: string,
    summaries: CellSummary[],
    pragmasByMode: Record<string, Record<string, unknown>>,
): { mdPath: string; csvPath: string; dir: string } => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(outDir, stamp);
    fs.mkdirSync(dir, { recursive: true });

    const mdPath = path.join(dir, 'results.md');
    const csvPath = path.join(dir, 'results.csv');

    fs.writeFileSync(mdPath, renderMarkdown(summaries, pragmasByMode), 'utf8');
    fs.writeFileSync(csvPath, renderCsv(summaries), 'utf8');

    return { mdPath, csvPath, dir };
};
