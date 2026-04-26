import { WorkloadOp } from '../runner.js';
import { SampledIds } from '../samples.js';

export const buildMicroOps = (samples: SampledIds): WorkloadOp[] => [
    {
        name:   'micro.findUnique:menuItem',
        weight: 1,
        run:    (prisma, ctx) => {
            const id = ctx.sample(samples.menuItemIds);
            return prisma.menuItem.findUnique({ where: { id }, select: { id: true, name: true, price: true } });
        },
    },
    {
        name:   'micro.findMany:menuItem',
        weight: 1,
        run:    (prisma, ctx) => {
            const cafeId = ctx.sample(samples.cafeIds);
            return prisma.menuItem.findMany({
                where:  { cafeId },
                select: { id: true, name: true, price: true },
                take:   50,
            });
        },
    },
    {
        name:   'micro.queryRawSelect1',
        weight: 1,
        run:    (prisma) => prisma.$queryRawUnsafe('SELECT 1 as v'),
    },
];
