import { DbPriority } from './db-context.js';

const PRIORITY_ORDER: DbPriority[] = ['critical', 'normal', 'background'];

export class PriorityLock {
    #locked = false;
    readonly #waiters: Record<DbPriority, Array<() => void>> = {
        critical:   [],
        normal:     [],
        background: [],
    };

    async acquire<T>(priority: DbPriority, callback: () => Promise<T>): Promise<T> {
        await this.#acquireInternal(priority);
        try {
            return await callback();
        } finally {
            this.#release();
        }
    }

    #acquireInternal(priority: DbPriority): Promise<void> {
        if (!this.#locked) {
            this.#locked = true;
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.#waiters[priority].push(resolve);
        });
    }

    #release(): void {
        for (const priority of PRIORITY_ORDER) {
            const next = this.#waiters[priority].shift();
            if (next != null) {
                next();
                return;
            }
        }

        this.#locked = false;
    }
}
