import { WorkloadOp } from '../runner.js';
import { SampledIds } from '../samples.js';
import { buildReadOps } from './reads.js';

// Mixed read/write: 70% reads, 30% writes. Writes hit append-friendly
// (SearchQuery), upsert-friendly (Review with synthetic users), and
// hot-row (MenuItem lastUpdateTime) paths.
export const buildMixedOps = (samples: SampledIds): WorkloadOp[] => {
    const reads = buildReadOps(samples).map(op => ({ ...op, name: `mixed.${op.name.replace(/^reads\./, 'r.')}` }));

    const writes: WorkloadOp[] = [
        {
            name:   'mixed.w.searchQuery.upsert',
            weight: 4,
            run:    async (prisma, ctx, opIndex) => {
                // ~10k distinct query keys to mix inserts and updates.
                const bucket = Math.floor(ctx.rng() * 10_000);
                const query = `bench-q-${bucket}`;
                return prisma.searchQuery.upsert({
                    where:  { query },
                    update: { count: { increment: 1 } },
                    create: { query, count: 1 },
                });
            },
        },
        {
            name:   'mixed.w.review.create',
            weight: 3,
            run:    async (prisma, ctx, opIndex) => {
                // Anonymous reviews (no userId) avoid the unique constraint and let us insert freely.
                const menuItemId = ctx.sample(samples.menuItemIds);
                return prisma.review.create({
                    data: {
                        menuItemId,
                        rating:      Math.floor(ctx.rng() * 11),
                        comment:     `bench-${opIndex}`,
                        displayName: 'bench',
                    },
                    select: { id: true },
                });
            },
        },
        {
            name:   'mixed.w.menuItem.touchUpdateTime',
            weight: 2,
            run:    async (prisma, ctx) => {
                // Hot-row contention: a small set of ids gets repeatedly updated.
                const id = samples.menuItemIds[Math.floor(ctx.rng() * Math.min(10, samples.menuItemIds.length))]!;
                return prisma.menuItem.update({
                    where: { id },
                    data:  { externalLastUpdateTime: new Date() },
                });
            },
        },
    ];

    // Read weight total ~14, write weight total = 9 → ~60/40 read/write. Tweak read weights down a touch
    // by halving so we get closer to 70/30.
    const downweightedReads = reads.map(op => ({ ...op, weight: op.weight * 1.5 }));

    return [...downweightedReads, ...writes];
};
