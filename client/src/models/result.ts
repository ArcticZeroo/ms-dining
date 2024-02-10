interface IResultOk<V> {
    isOk: true;
    value: V;
}

interface IResultErr<E> {
    isOk: false;
    error: E;
}

export type Result<V, E> = IResultOk<V> | IResultErr<E>;

export const Result = {
    ok: <V>(value: V): IResultOk<V> => ({ isOk: true, value }),
    err: <E>(error: E): IResultErr<E> => ({ isOk: false, error }),
    isOk: <V, E>(result: Result<V, E>): result is IResultOk<V> => result.isOk,
    isErr: <V, E>(result: Result<V, E>): result is IResultErr<E> => !result.isOk,
    expect: <V, E>(result: Result<V, E>): V => {
        if (Result.isErr(result)) {
            throw result.error;
        }

        return result.value;
    }
}
