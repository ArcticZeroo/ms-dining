import { PrismaClient } from '@prisma/client';
import { PrioritySemaphore } from '../../api/storage/priority-semaphore.js';

export interface WorkloadOp {
    name: string;
    weight: number;
    run: (prisma: PrismaClient, ctx: WorkloadContext, opIndex: number) => Promise<unknown>;
}

export interface WorkloadContext {
    rng: () => number;
    sample: <T>(arr: readonly T[]) => T;
    state: Record<string, unknown>;
}

export interface RunnerOptions {
    prisma: PrismaClient;
    ops: WorkloadOp[];
    iterations: number;
    concurrency: number;
    useLock: boolean;
    ctx: WorkloadContext;
}

export interface RunResult {
    iterations: number;
    concurrency: number;
    useLock: boolean;
    wallTimeMs: number;
    latenciesMs: number[];
    errorCount: number;
    busyErrorCount: number;
    perOpStats: Map<string, { count: number; errorCount: number; latencies: number[] }>;
}

const SQLITE_BUSY_PATTERN = /SQLITE_BUSY|database is locked/i;

const pickOp = (ops: WorkloadOp[], rng: () => number, totalWeight: number): WorkloadOp => {
    let r = rng() * totalWeight;
    for (const op of ops) {
        r -= op.weight;
        if (r <= 0) {
            return op;
        }
    }
    return ops[ops.length - 1]!;
};

export const runWorkload = async (options: RunnerOptions): Promise<RunResult> => {
    const { prisma, ops, iterations, concurrency, useLock, ctx } = options;
    const totalWeight = ops.reduce((sum, op) => sum + op.weight, 0);

    const lock = useLock ? new PrioritySemaphore(1) : null;
    const latenciesMs: number[] = [];
    const perOpStats = new Map<string, { count: number; errorCount: number; latencies: number[] }>();
    for (const op of ops) {
        perOpStats.set(op.name, { count: 0, errorCount: 0, latencies: [] });
    }

    let nextIndex = 0;
    let errorCount = 0;
    let busyErrorCount = 0;

    const worker = async (): Promise<void> => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const opIndex = nextIndex++;
            if (opIndex >= iterations) {
                return;
            }

            const op = pickOp(ops, ctx.rng, totalWeight);
            const stats = perOpStats.get(op.name)!;
            stats.count++;

            const exec = () => op.run(prisma, ctx, opIndex);

            const t0 = performance.now();
            try {
                if (lock != null) {
                    await lock.acquire('normal', exec);
                } else {
                    await exec();
                }
                const elapsed = performance.now() - t0;
                latenciesMs.push(elapsed);
                stats.latencies.push(elapsed);
            } catch (err) {
                errorCount++;
                stats.errorCount++;
                if (err instanceof Error && SQLITE_BUSY_PATTERN.test(err.message)) {
                    busyErrorCount++;
                }
            }
        }
    };

    const wallStart = performance.now();
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    const wallTimeMs = performance.now() - wallStart;

    return {
        iterations,
        concurrency,
        useLock,
        wallTimeMs,
        latenciesMs,
        errorCount,
        busyErrorCount,
        perOpStats,
    };
};
