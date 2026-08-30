import { useCallback, useEffect, useRef } from 'react';
import { unstable_useBlocker as useBlocker, type unstable_BlockerFunction } from 'react-router-dom';

export type NavigationConfirmArgs = Parameters<unstable_BlockerFunction>[0];

// Given an attempted navigation, returns the confirmation message to prompt with,
// or null to allow the navigation through unblocked.
export type NavigationConfirmResolver = (args: NavigationConfirmArgs) => string | null;

/**
 * Prompts with confirm(message) before allowing an in-app navigation (including
 * browser Back/Forward) for which `resolveMessage` returns a non-null message.
 * Complements useBeforeUnload, which covers full-page unloads the router can't
 * see.
 *
 * `resolveMessage` should be memoized (e.g. useCallback) so the underlying blocker
 * isn't re-registered on every render. Requires a data router (RouterProvider).
 */
export const useNavigationConfirm = (resolveMessage: NavigationConfirmResolver) => {
    // The message chosen for the currently-blocked navigation. Set synchronously
    // when the blocker decides to block, then read when we prompt.
    const messageRef = useRef<string | null>(null);

    const shouldBlock = useCallback<unstable_BlockerFunction>(
        (args) => {
            messageRef.current = resolveMessage(args);
            return messageRef.current != null;
        },
        [resolveMessage],
    );

    const blocker = useBlocker(shouldBlock);

    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }

        const message = messageRef.current;
        if (message == null || window.confirm(message)) {
            blocker.proceed();
        } else {
            blocker.reset();
        }
    }, [blocker]);
};
