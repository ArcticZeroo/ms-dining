/**
 * Vitest setup: shared global stubs needed by stores that import settings
 * (which touch localStorage at module load and on every write).
 *
 * We use a Map-backed in-memory shim so individual tests don't need to
 * worry about whether their store mutations end up triggering a persist
 * subscriber. Each test can call `localStorage.clear()` in its setup if
 * isolation matters.
 */

class MemoryStorage implements Storage {
    private readonly entries = new Map<string, string>();

    get length(): number {
        return this.entries.size;
    }

    clear(): void {
        this.entries.clear();
    }

    getItem(key: string): string | null {
        return this.entries.get(key) ?? null;
    }

    key(index: number): string | null {
        return Array.from(this.entries.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.entries.delete(key);
    }

    setItem(key: string, value: string): void {
        this.entries.set(key, value);
    }
}

if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
        value:        new MemoryStorage(),
        writable:     false,
        configurable: true,
    });
}
