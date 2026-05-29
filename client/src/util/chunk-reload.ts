/**
 * When a deploy replaces hashed chunk files, stale tabs may try to load
 * old chunks that no longer exist. Detect this and reload once to pick
 * up the new entry point (which references the new chunk hashes).
 */

const RELOAD_KEY = '__chunk_reload';

export const registerChunkLoadErrorHandler = () => {
    window.addEventListener('error', (event) => {
        const isChunkError = event.message?.includes('Failed to fetch dynamically imported module')
            || event.message?.includes('Importing a module script failed');
        if (isChunkError && !sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, '1');
            window.location.reload();
        }
    });
    // Clear the flag on successful load so future deploys can trigger another reload.
    sessionStorage.removeItem(RELOAD_KEY);
};
