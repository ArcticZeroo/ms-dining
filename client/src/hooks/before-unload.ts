import { useEffect } from 'react';

/**
 * Prompts the browser's native "leave site?" confirmation while `shouldBlock` is
 * true, covering tab close, refresh, and navigation away. Modern browsers show
 * their own generic message and ignore custom text, so we only signal intent to
 * block. Use this to guard against leaving mid-way through an irreversible action
 * (e.g. a payment that has been submitted but not yet confirmed).
 */
export const useBeforeUnload = (shouldBlock: boolean) => {
    useEffect(() => {
        if (!shouldBlock) {
            return;
        }

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // Legacy browsers require returnValue to be set to trigger the prompt.
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [shouldBlock]);
};
