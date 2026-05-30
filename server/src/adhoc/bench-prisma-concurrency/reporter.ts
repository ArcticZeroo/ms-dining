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

const percentile = (sorted: number[], percentileValue: number): number => {
    if (sorted.length === 0) {
        return 0;
    }
    const idx = Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length));
    return sorted[idx]!;
};

const mean = (values: number[]): number => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const stddev = (values: number[]): number => {
    if (values.length < 2) {
        return 0;
    }
    const average = mean(values);
    return Math.sqrt(values.reduce((accumulator, value) => accumulator + (value - average) ** 2, 0) / (values.length - 1));
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
    for (const run of runs) {
        for (const latency of run.latenciesMs) {
            allLatencies.push(latency);
        }
    }
    allLatencies.sort((leftLatency, rightLatency) => leftLatency - rightLatency);

    const wallTimes = runs.map(run => run.wallTimeMs);
    const throughputs = runs.map(run => (run.iterations - run.errorCount) / (run.wallTimeMs / 1000));

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
        totalErrors:     runs.reduce((sum, run) => sum + run.errorCount, 0),
        totalBusyErrors: runs.reduce((sum, run) => sum + run.busyErrorCount, 0),
    };
};

const fmt = (value: number, digits = 2): string => Number.isFinite(value) ? value.toFixed(digits) : '—';

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
        for (const [k, value] of Object.entries(pragmas)) {
            const display = typeof value === 'bigint' ? value.toString() : JSON.stringify(value);
            lines.push(`| \`${k}\` | \`${display}\` |`);
        }
        lines.push('');
    }

    const groupKeys = Array.from(new Set(summaries.map(summary => `${summary.scenario}@${summary.journalMode}`)));
    for (const key of groupKeys) {
        const [scenario, journalMode] = key.split('@');
        const rows = summaries.filter(summary => summary.scenario === scenario && summary.journalMode === journalMode);
        lines.push(`## Scenario: ${scenario} (journal_mode=${journalMode})`);
        lines.push('');
        lines.push('| Lock | Concurrency | Iter/run | Repeats | Wall ms (mean ± σ) | Throughput (ops/s) | p50 ms | p95 ms | p99 ms | Errors | SQLITE_BUSY |');
        lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

        rows.sort((leftRow, rightRow) => (Number(rightRow.useLock) - Number(leftRow.useLock)) || (leftRow.concurrency - rightRow.concurrency));

        const baseline = rows.find(candidateRow => candidateRow.useLock && candidateRow.concurrency === 1);
        const baselineThroughput = baseline?.meanThroughput ?? 0;

        for (const row of rows) {
            const speedup = baselineThroughput > 0
                ? `${fmt(row.meanThroughput / baselineThroughput, 2)}×`
                : '—';
            lines.push([
                '',
                row.useLock ? 'on' : 'off',
                row.concurrency,
                row.iterations,
                row.repeats,
                `${fmt(row.meanWallMs)} ± ${fmt(row.stddevWallMs)}`,
                `${fmt(row.meanThroughput)} (${speedup} vs baseline)`,
                fmt(row.p50, 3),
                fmt(row.p95, 3),
                fmt(row.p99, 3),
                row.totalErrors,
                row.totalBusyErrors,
                '',
            ].join('|'));
        }
        lines.push('');

        const best = rows
            .filter(row => !row.useLock)
            .sort((leftRow, rightRow) => rightRow.meanThroughput - leftRow.meanThroughput)[0];
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
    const scenarios = Array.from(new Set(summaries.map(summary => summary.scenario)));
    const modes = Array.from(new Set(summaries.map(summary => summary.journalMode)));
    if (modes.length > 1) {
        lines.push('## Cross-journal-mode comparison (best unlocked throughput per scenario)');
        lines.push('');
        lines.push(`| Scenario | ${modes.map(mode => `${mode} ops/s (best c)`).join(' | ')} |`);
        lines.push(`|---|${modes.map(() => '---:').join('|')}|`);
        for (const scenario of scenarios) {
            const cells = modes.map(mode => {
                const best = summaries
                    .filter(summary => summary.scenario === scenario && summary.journalMode === mode && !summary.useLock)
                    .sort((leftSummary, rightSummary) => rightSummary.meanThroughput - leftSummary.meanThroughput)[0];
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
    const rows = summaries.map(summary => [
        summary.scenario, summary.journalMode, summary.useLock, summary.concurrency, summary.iterations, summary.repeats,
        summary.meanWallMs, summary.stddevWallMs, summary.meanThroughput,
        summary.p50, summary.p95, summary.p99, summary.meanLatency, summary.totalErrors, summary.totalBusyErrors,
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
