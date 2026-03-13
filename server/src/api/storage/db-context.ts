import { AsyncLocalStorage } from 'node:async_hooks';

export type DbPriority = 'critical' | 'normal' | 'background';

const PRIORITY_RANK: Record<DbPriority, number> = {
    critical:   0,
    normal:     1,
    background: 2,
};

const dbPriorityStorage = new AsyncLocalStorage<DbPriority>();

export const getDbPriority = (): DbPriority => dbPriorityStorage.getStore() ?? 'background';

/**
 * Run `fn` with the given DB priority.
 * If a higher (lower-numbered) priority is already active, keep it.
 */
export const runWithDbPriority = <T>(priority: DbPriority, fn: () => T): T => {
    const current = dbPriorityStorage.getStore();
    if (current != null && PRIORITY_RANK[current] <= PRIORITY_RANK[priority]) {
        return fn();
    }
    return dbPriorityStorage.run(priority, fn);
};
