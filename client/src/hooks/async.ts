import { IPromiseState, PromiseStatus } from '../models/async.ts';
import { useState } from 'react';

export const usePromise = <T>(promise: Promise<T> | null | undefined): IPromiseState<T> => {
    const [state, setState] = useState<IPromiseState<T>>({
        status: promise ? PromiseStatus.inProgress : PromiseStatus.notStarted
    });

    if (promise) {
        promise.then(
            value => setState({
                status: PromiseStatus.complete,
                value
            }),
            error => setState({
                status: PromiseStatus.complete,
                error
            })
        );
    }

    return state;
}