/**
 * Options for queries whose data only changes via explicit invalidation
 * (e.g. cafe menus driven by the server's cron job).
 *
 * - `staleTime: Infinity` disables any stale-time-driven background refetches.
 *   The data is already considered fresh forever until something tells us
 *   otherwise.
 * - `gcTime: Infinity` opts out of unobserved-query garbage collection. The
 *   global default GCs at 10 minutes, which would defeat the boot-time menu
 *   warm-up for any user who takes a coffee break before opening a cafe page.
 *
 * Pair with an explicit `invalidateQueries` on whatever mutation can change
 * the data (see `useForceRefreshCafesMutation`). A planned Tier 2 freshness
 * probe endpoint will provide a more granular invalidation path.
 */
export const longLivedQueryOptions = {
    staleTime: Infinity,
    gcTime:    Infinity,
} as const;
