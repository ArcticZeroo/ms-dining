import { UseMutationResult } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = UseMutationResult<any, any, any, any>;

/**
 * Maps a TanStack mutation's state to the disabled/error/success class
 * vocabulary used by buttons that don't define their own success/error CSS.
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
 * "Is the user allowed to click this button right now?". Mutation is idle or
 * errored (so a retry click should go through). Pending or just-succeeded
 * buttons are disabled.
 */
export const canUseMutationButton = (mutation: AnyMutation): boolean => {
    return !mutation.isPending && !mutation.isSuccess;
};
