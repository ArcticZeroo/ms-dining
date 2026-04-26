import { WorkloadOp } from '../runner.js';
import { SampledIds } from '../samples.js';

// Approximates representative read traffic: menu item detail lookups,
// daily-station joins, search-query top-N, and review reads.
export const buildReadOps = (samples: SampledIds): WorkloadOp[] => {
    const ops: WorkloadOp[] = [
        {
            name:   'reads.menuItem.detailWithModifiers',
            weight: 4,
            run:    (prisma, ctx) => {
                const id = ctx.sample(samples.menuItemIds);
                return prisma.menuItem.findUnique({
                    where:   { id },
                    include: {
                        modifiers:  {
                            include: { modifier: { include: { choices: true } } },
                            orderBy: { index: 'asc' },
                        },
                        searchTags: { select: { name: true } },
                    },
                });
            },
        },
        {
            name:   'reads.dailyStations.byDate',
            weight: 3,
            run:    (prisma, ctx) => {
                const dateString = ctx.sample(samples.dateStrings);
                return prisma.dailyStation.findMany({
                    where:  { dateString },
                    select: {
                        id:        true,
                        stationId: true,
                        cafeId:    true,
                        opensAt:   true,
                        closesAt:  true,
                        categories: {
                            select: {
                                name:      true,
                                menuItems: { select: { menuItemId: true } },
                            },
                        },
                    },
                });
            },
        },
        {
            name:   'reads.searchQuery.top',
            weight: 1,
            run:    (prisma) => prisma.searchQuery.findMany({
                orderBy: { count: 'desc' },
                take:    25,
            }),
        },
        {
            name:   'reads.review.recent',
            weight: 1,
            run:    (prisma) => prisma.review.findMany({
                orderBy: { createdAt: 'desc' },
                take:    20,
                include: {
                    user:     { select: { displayName: true } },
                    menuItem: { select: { name: true, normalizedName: true } },
                },
            }),
        },
        {
            name:   'reads.review.aggregateByName',
            weight: 2,
            run:    (prisma, ctx) => {
                const normalizedName = ctx.sample(samples.normalizedMenuItemNames);
                return prisma.review.aggregate({
                    where:  { menuItem: { normalizedName, groupId: null } },
                    _count: true,
                    _avg:   { rating: true },
                });
            },
        },
        {
            name:   'reads.station.byId',
            weight: 2,
            run:    (prisma, ctx) => {
                const id = ctx.sample(samples.stationIds);
                return prisma.station.findUnique({
                    where:  { id },
                    select: { id: true, name: true, normalizedName: true, cafeId: true, groupId: true },
                });
            },
        },
    ];

    if (samples.groupIds.length > 0) {
        ops.push({
            name:   'reads.review.aggregateByGroup',
            weight: 1,
            run:    (prisma, ctx) => {
                const groupId = ctx.sample(samples.groupIds);
                return prisma.review.aggregate({
                    where:  { menuItem: { groupId } },
                    _count: true,
                    _avg:   { rating: true },
                });
            },
        });
    }

    return ops;
};
