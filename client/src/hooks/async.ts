import { Result } from '../models/result.ts';
import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { useEffect } from 'react';

export const useDelayedResultPromiseState = <V, E>(runPromiseCallback: () => Promise<Result<V, E>>, convertExceptionToResult: (exception: unknown) => Result<V, E>): Result<V, E> | undefined => {
    const { value, error, run } = useDelayedPromiseState(runPromiseCallback);

    useEffect(() => {
        run();
    }, [run]);

    if (value) {
        return value;
    }

    if (error) {
        return convertExceptionToResult(error);
    }

    return undefined;
}