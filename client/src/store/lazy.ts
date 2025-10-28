import { MaybePromise } from '../models/async.js';
import { Lock } from '../util/lock.js';

const noValueSymbol = Symbol('NoValue');

export class LazyResource<T> {
    private _lock = new Lock();
    private _value: T | typeof noValueSymbol = noValueSymbol;
    private readonly _factory: () => MaybePromise<T>;

    constructor(factory: () => MaybePromise<T>) {
        this._factory = factory;
    }

    async get(forceRefresh: boolean = false): Promise<T> {
        return this._lock.acquire(async () => {
            if (forceRefresh || this._value === noValueSymbol) {
                this._value = await this._factory();
            }

            return this._value;
        });
    }

    async clear() {
        await this._lock.acquire(() => {
            this._value = noValueSymbol;
        });
    }

    async set(value: T) {
        await this._lock.acquire(() => {
            this._value = value;
        });
    }
}