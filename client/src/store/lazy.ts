import { IRunnablePromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { MaybePromise } from '../models/async.js';
import { ValueNotifier } from '../util/events.ts';

const noValueSymbol = Symbol('NoValue');

export interface ILazyPromiseState<T> extends IRunnablePromiseState<T> {
    promise: Promise<T>;
}

export class LazyResource<T> {
    private _idSymbol = Symbol();
    private _state: ValueNotifier<ILazyPromiseState<T>> | typeof noValueSymbol = noValueSymbol;
    private readonly _factory: () => MaybePromise<T>;
    private readonly _runForPromiseState = () => this.get(true /*forceRefresh*/);

    constructor(factory: () => MaybePromise<T>) {
        this._factory = factory;
    }

    async _factoryAsPromise() {
        return this._factory();
    }

    async _runFactory(promise: Promise<T>) {
        if (!(this._state instanceof ValueNotifier)) {
            return;
        }

        const mySymbol = Symbol();
        this._idSymbol = mySymbol;

        try {
            const result = await promise;

            // A newer run has started, ignore this result
            if (this._idSymbol !== mySymbol) {
                return;
            }

            this._state.value = {
                run: this._runForPromiseState,
                stage: PromiseStage.success,
                value: result,
                error: undefined,
                promise
            };
        } catch (error) {
            if (this._idSymbol !== mySymbol) {
                return;
            }

            this._state.value = {
                run: this._runForPromiseState,
                stage: PromiseStage.error,
                value: undefined,
                error,
                promise,
            };
        }
    }

    get(forceRefresh: boolean = false): ValueNotifier<ILazyPromiseState<T>> {
        if (forceRefresh || this._state === noValueSymbol) {
            const promise = this._factoryAsPromise();
            this._state = new ValueNotifier<ILazyPromiseState<T>>({
                run: this._runForPromiseState,
                stage: PromiseStage.running,
                value: undefined,
                error: undefined,
                promise
            });

            this._runFactory(promise)
                .catch(err => console.error('Could not run factory in lazy resource:', err));
        }

        return this._state;
    }

    clear() {
        this._state = noValueSymbol;
    }

    set(value: T) {
        const state: ILazyPromiseState<T> = {
            run: this._runForPromiseState,
            stage: PromiseStage.success,
            value,
            error: undefined,
            promise: Promise.resolve(value)
        };

        if (this._state instanceof ValueNotifier) {
            this._state.value = state;
        } else {
            this._state = new ValueNotifier(state);
        }
    }

    async update(work: (value: T) => MaybePromise<T>) {
        const currentState = this.get();
        const currentValue = await currentState.value.promise;
        const newValue = await work(currentValue);
        this.set(newValue);
    }
}