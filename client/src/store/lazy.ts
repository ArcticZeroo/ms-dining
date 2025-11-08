import { IRunnablePromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { MaybePromise } from '../models/async.js';
import { ListenerCallback, ListenerManager, ValueNotifier } from '../util/events.ts';

export interface ILazyPromiseState<T> extends IRunnablePromiseState<T> {
    promise: Promise<T>;
}

type LazyResourceListenerArgs<T> = [ILazyPromiseState<T>];
type LazyResourceListenerCallback<T> = ListenerCallback<LazyResourceListenerArgs<T>>;

export class LazyResource<T> {
    #idSymbol = Symbol();
    readonly #factory: () => MaybePromise<T>;
    readonly #runForPromiseState = () => this.get(true /*forceRefresh*/);
    readonly #listeners = new ListenerManager<LazyResourceListenerArgs<T>>();
    #state: ValueNotifier<ILazyPromiseState<T>> | undefined = undefined;

    constructor(factory: () => MaybePromise<T>) {
        this.#factory = factory;
    }

    get hasBeenRun(): boolean {
        return this.#state != null && this.#state.value.stage !== PromiseStage.notRun;
    }

    async #getFactoryAsPromise() {
        return this.#factory();
    }

    #assignState(state: ILazyPromiseState<T>): void {
        if (!this.#state) {
            this.#state = new ValueNotifier<ILazyPromiseState<T>>(state);
            this.#state.addListener((newState) => {
                this.#listeners.notify(newState);
            });
            this.#listeners.notify(state);
        } else {
            this.#state.value = state;
        }
    }

    async #runFactory(promise: Promise<T>) {
        const mySymbol = Symbol();
        this.#idSymbol = mySymbol;

        try {
            const result = await promise;

            // A newer run has started, ignore this result
            if (this.#idSymbol !== mySymbol) {
                return;
            }

            this.#assignState({
                run: this.#runForPromiseState,
                stage: PromiseStage.success,
                value: result,
                error: undefined,
                promise
            });
        } catch (error) {
            if (this.#idSymbol !== mySymbol) {
                return;
            }

            this.#assignState({
                run: this.#runForPromiseState,
                stage: PromiseStage.error,
                value: undefined,
                error,
                promise,
            });
        }
    }

    get(forceRefresh: boolean = false): ValueNotifier<ILazyPromiseState<T>> {
        if (forceRefresh || !this.hasBeenRun) {
            const promise = this.#getFactoryAsPromise();
            this.#assignState({
                run: this.#runForPromiseState,
                stage: PromiseStage.running,
                value: undefined,
                error: undefined,
                promise
            });

            this.#runFactory(promise)
                .catch(err => console.error('Could not run factory in lazy resource:', err));
        }

        if (!this.#state) {
            throw new Error('Lazy resource should have state after running factory');
        }

        return this.#state;
    }

    set(value: T) {
        this.#assignState({
            run:     this.#runForPromiseState,
            stage:   PromiseStage.success,
            value,
            error:   undefined,
            promise: Promise.resolve(value)
        });
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

    async getExisting(): Promise<T | undefined> {
        if (!this.hasBeenRun) {
            return undefined;
        }

        const currentState = this.get();
        return currentState.value.promise;
    }

    addLazyListener(listener: LazyResourceListenerCallback<T>): () => void {
        return this.#listeners.addListener(listener);
    }
}