import { IRunnablePromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { MaybePromise } from '../models/async.js';
import { ValueNotifier } from '../util/events.ts';

export interface ILazyPromiseState<T> extends IRunnablePromiseState<T> {
    promise: Promise<T>;
}

export class LazyResource<T> {
    private _idSymbol = Symbol();
    private readonly _factory: () => MaybePromise<T>;
    private readonly _runForPromiseState = () => this.get(true /*forceRefresh*/);
    private readonly _state: ValueNotifier<ILazyPromiseState<T>> = new ValueNotifier<ILazyPromiseState<T>>({
        run: this._runForPromiseState,
        stage: PromiseStage.notRun,
        value: undefined,
        error: undefined,
        promise: Promise.reject(new Error('Promise not yet started'))
    });

    constructor(factory: () => MaybePromise<T>) {
        this._factory = factory;
    }

    get hasBeenRun(): boolean {
        return this._state.value.stage !== PromiseStage.notRun;
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
        if (forceRefresh || this._state.value.stage === PromiseStage.notRun) {
            const promise = this._factoryAsPromise();
            this._state.value = {
                run: this._runForPromiseState,
                stage: PromiseStage.running,
                value: undefined,
                error: undefined,
                promise
            };

            this._runFactory(promise)
                .catch(err => console.error('Could not run factory in lazy resource:', err));
        }

        return this._state;
    }

    clear() {
        this._state.value = {
            run: this._runForPromiseState,
            stage: PromiseStage.notRun,
            value: undefined,
            error: undefined,
            promise: Promise.reject(new Error('Promise not yet started'))
        };
    }

    set(value: T) {
        this._state.value = {
            run:     this._runForPromiseState,
            stage:   PromiseStage.success,
            value,
            error:   undefined,
            promise: Promise.resolve(value)
        };
    }

    async update(work: (value: T) => MaybePromise<T>, skipUpdateIfNotRun: boolean = false) {
        if (skipUpdateIfNotRun && !this.hasBeenRun) {
            return;
        }

        const currentState = this.get();
        const currentValue = await currentState.value.promise;
        const newValue = await work(currentValue);
        this.set(newValue);
    }

    async updateExisting(work: (value: T) => MaybePromise<T>) {
        await this.update(work, true /*skipUpdateIfNotRun*/);
    }
}