export enum PromiseStatus {
    notStarted,
    inProgress,
    complete
}

export interface IPromiseState<T> {
    status: PromiseStatus;
    value?: T;
    error?: unknown;
}
