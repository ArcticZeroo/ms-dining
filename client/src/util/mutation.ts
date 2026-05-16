import { UseMutationResult } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = UseMutationResult<any, any, any, any>;

/**
 * Map a TanStack mutation result onto the legacy `promiseStageToButtonClass`
 * vocabulary so existing button styling (success, error, disabled) keeps
 * working without per-call boilerplate.
 */
export const mutationButtonClass = (mutation: AnyMutation): string => {
    if (mutation.isPending) {
        return 'disabled';
    }
    if (mutation.isError) {
        return 'error';
    }
    if (mutation.isSuccess) {
        return 'success';
    }
    return '';
};

/**
 * "Is the user allowed to click this button right now?". Matches
 * `canUseControllingButton` for the legacy PromiseStage flow: idle or errored
 * (so the user can retry) are OK; pending or success are not.
 */
export const canUseMutationButton = (mutation: AnyMutation): boolean => {
    return !mutation.isPending && !mutation.isSuccess;
};
