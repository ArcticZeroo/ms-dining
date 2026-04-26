import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from './config.js';
import { copyDatabase } from './db-copy.js';
import { runWorkload, RunResult, WorkloadOp } from './runner.js';
import { sampleIds, validateSamples } from './samples.js';
import { makeRng } from './rng.js';
import { buildMicroOps } from './scenarios/micro.js';
import { buildReadOps } from './scenarios/reads.js';
import { buildMixedOps } from './scenarios/mixed.js';
import { CellSummary, summarizeCell, writeResults } from './reporter.js';

const __filename = fileURLToPath(import.meta.url);
// dist/adhoc/bench-prisma-concurrency/main.js → server root is 3 dirs up.
const SERVER_DIR = path.resolve(path.dirname(__filename), '..', '..', '..');
const DEFAULT_SOURCE_DB = path.join(SERVER_DIR, 'dining.db');
const DEFAULT_OUT_DIR = path.join(SERVER_DIR, 'src', 'adhoc', 'bench-prisma-concurrency', 'results');

const PRAGMAS = ['journal_mode', 'synchronous', 'busy_timeout', 'cache_size', 'wal_autocheckpoint', 'page_size', 'mmap_size'];

const readPragmas = async (prisma: PrismaClient): Promise<Record<string, unknown>> => {
    const out: Record<string, unknown> = {};
    for (const pragma of PRAGMAS) {
        try {
            const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`PRAGMA ${pragma}`);
            const row = result[0];
            out[pragma] = row == null ? null : Object.values(row)[0];
        } catch (err) {
            out[pragma] = `error: ${(err as Error).message}`;
        }
    }
    return out;
};

const applyPragmas = async (
    prisma: PrismaClient,
    journalMode: string,
    synchronous: string,
): Promise<void> => {
    if (journalMode !== 'inherit') {
        // PRAGMA journal_mode is persistent and changes the on-disk format for WAL.
        const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `PRAGMA journal_mode=${journalMode}`,
        );
        const got = result[0] == null ? null : String(Object.values(result[0])[0]);
        if (got != null && got.toLowerCase() !== journalMode.toLowerCase()) {
            throw new Error(`Failed to set journal_mode=${journalMode}; SQLite reported '${got}'.`);
        }
    }
    if (synchronous !== 'inherit') {
        await prisma.$queryRawUnsafe(`PRAGMA synchronous=${synchronous}`);
    }
};

interface ScenarioDef {
    name: string;
    build: (samples: Awaited<ReturnType<typeof sampleIds>>) => WorkloadOp[];
}

const SCENARIO_DEFS: Record<'micro' | 'reads' | 'mixed', ScenarioDef> = {
    micro: { name: 'micro', build: buildMicroOps },
    reads: { name: 'reads', build: buildReadOps },
    mixed: { name: 'mixed', build: buildMixedOps },
};

const main = async (): Promise<void> => {
    const config = parseConfig(process.argv.slice(2), {
        sourceDb: DEFAULT_SOURCE_DB,
        outDir:   DEFAULT_OUT_DIR,
    });

    console.log('Bench config:', config);

    const summaries: CellSummary[] = [];
    const pragmasByMode: Record<string, Record<string, unknown>> = {};

    for (const journalMode of config.journalModes) {
        console.log(`\n#### journal_mode=${journalMode} ####`);

        for (const scenarioKey of config.scenarios) {
            const def = SCENARIO_DEFS[scenarioKey];
            console.log(`\n=== Scenario: ${def.name} (journal_mode=${journalMode}) ===`);

            for (const useLock of [true, false]) {
                for (const concurrency of config.concurrencies) {
                    if (useLock && concurrency !== 1) continue;

                    const cellLabel = `${def.name}@${journalMode} | lock=${useLock ? 'on' : 'off'} | c=${concurrency}`;
                    console.log(`\n  ${cellLabel}`);

                    const runs: RunResult[] = [];
                    for (let r = 0; r < config.repeats; r++) {
                        const copied = copyDatabase(config.sourceDb);
                        const prisma = new PrismaClient({ datasourceUrl: copied.url });

                        try {
                            await applyPragmas(prisma, journalMode, config.synchronous);

                            if (r === 0 && useLock && concurrency === 1 && pragmasByMode[journalMode] == null) {
                                pragmasByMode[journalMode] = await readPragmas(prisma);
                                console.log(`  pragmas (${journalMode}):`, pragmasByMode[journalMode]);
                            }

                            const samples = await sampleIds(prisma);
                            validateSamples(samples);
                            const ops = def.build(samples);
                            const rng = makeRng(0xC0FFEE + r * 31);
                            const ctx = {
                                rng,
                                sample: <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!,
                                state:  {} as Record<string, unknown>,
                            };

                            if (config.warmupIterations > 0) {
                                await runWorkload({
                                    prisma,
                                    ops,
                                    iterations:  config.warmupIterations,
                                    concurrency,
                                    useLock,
                                    ctx,
                                });
                            }

                            if (typeof globalThis.gc === 'function') {
                                globalThis.gc();
                            }

                            const result = await runWorkload({
                                prisma,
                                ops,
                                iterations:  config.iterations,
                                concurrency,
                                useLock,
                                ctx,
                            });

                            const opsPerSec = (result.iterations - result.errorCount) / (result.wallTimeMs / 1000);
                            console.log(`    repeat ${r + 1}/${config.repeats}: ${result.wallTimeMs.toFixed(0)}ms, ${opsPerSec.toFixed(1)} ops/s, errors=${result.errorCount} (busy=${result.busyErrorCount})`);

                            runs.push(result);
                        } finally {
                            await prisma.$disconnect();
                            if (!config.keepDb) copied.cleanup();
                        }
                    }

                    summaries.push(summarizeCell(def.name, journalMode, concurrency, useLock, config.iterations, runs));
                }
            }
        }
    }

    const { mdPath, csvPath, dir } = writeResults(config.outDir, summaries, pragmasByMode);
    console.log(`\nResults written to:\n  ${mdPath}\n  ${csvPath}`);
    console.log(`Directory: ${dir}`);
};

main().then(
    () => process.exit(0),
    (err) => {
        console.error(err);
        process.exit(1);
    },
);
