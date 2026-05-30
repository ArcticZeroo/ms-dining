export type JournalMode = 'inherit' | 'wal' | 'delete' | 'truncate' | 'memory' | 'persist' | 'off';
export type SyncMode = 'inherit' | 'off' | 'normal' | 'full' | 'extra';

export interface BenchConfig {
    scenarios: Array<'micro' | 'reads' | 'mixed'>;
    concurrencies: number[];
    iterations: number;
    repeats: number;
    warmupIterations: number;
    outDir: string;
    sourceDb: string;
    keepDb: boolean;
    journalModes: JournalMode[];
    synchronous: SyncMode;
}

const parseList = <T>(raw: string | undefined, fallback: T[], map: (item: string) => T): T[] => {
    if (raw == null || raw.length === 0) {
        return fallback;
    }
    return raw.split(',').map(item => map(item.trim())).filter(Boolean as unknown as <U>(value: U) => value is U);
};

const getFlag = (argv: string[], name: string): string | undefined => {
    const prefix = `--${name}=`;
    for (const arg of argv) {
        if (arg.startsWith(prefix)) {
            return arg.slice(prefix.length);
        }
    }
    return undefined;
};

const hasFlag = (argv: string[], name: string): boolean => argv.includes(`--${name}`);

export const parseConfig = (argv: string[], defaults: { sourceDb: string; outDir: string }): BenchConfig => {
    const scenarioRaw = getFlag(argv, 'scenario');
    const scenarios: Array<'micro' | 'reads' | 'mixed'> = scenarioRaw == null || scenarioRaw === 'all'
        ? ['micro', 'reads', 'mixed']
        : scenarioRaw.split(',').map(scenario => scenario.trim()).filter((scenario): scenario is 'micro' | 'reads' | 'mixed' =>
            scenario === 'micro' || scenario === 'reads' || scenario === 'mixed');

    const concurrencies = parseList(getFlag(argv, 'concurrency'), [1, 2, 4, 8, 16, 32], rawConcurrency => Number.parseInt(rawConcurrency, 10))
        .filter(concurrency => Number.isFinite(concurrency) && concurrency > 0);

    const iterations = Number.parseInt(getFlag(argv, 'iterations') ?? '500', 10);
    const repeats = Number.parseInt(getFlag(argv, 'repeats') ?? '5', 10);
    const warmupIterations = Number.parseInt(getFlag(argv, 'warmup') ?? '50', 10);

    const validJournal: JournalMode[] = ['inherit', 'wal', 'delete', 'truncate', 'memory', 'persist', 'off'];
    const journalRaw = getFlag(argv, 'journal-mode');
    const journalModes: JournalMode[] = journalRaw == null
        ? ['inherit']
        : journalRaw.split(',').map(journalMode => journalMode.trim().toLowerCase()).filter((journalMode): journalMode is JournalMode =>
            (validJournal as string[]).includes(journalMode));
    if (journalModes.length === 0) {
        throw new Error(`--journal-mode must be one or more of: ${validJournal.join(', ')}`);
    }

    const validSync: SyncMode[] = ['inherit', 'off', 'normal', 'full', 'extra'];
    const syncRaw = (getFlag(argv, 'synchronous') ?? 'inherit').toLowerCase();
    if (!(validSync as string[]).includes(syncRaw)) {
        throw new Error(`--synchronous must be one of: ${validSync.join(', ')}`);
    }
    const synchronous = syncRaw as SyncMode;

    return {
        scenarios,
        concurrencies,
        iterations,
        repeats,
        warmupIterations,
        outDir:    getFlag(argv, 'out') ?? defaults.outDir,
        sourceDb:  getFlag(argv, 'db') ?? defaults.sourceDb,
        keepDb:    hasFlag(argv, 'keep-db'),
        journalModes,
        synchronous,
    };
};
