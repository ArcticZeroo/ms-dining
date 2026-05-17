/**
 * Options for queries backed by a server endpoint that emits an ETag whose
 * value only advances when the underlying data actually changes (see
 * server/src/middleware/menu-etag.ts).
 *
 * Refetches go out as conditional `If-None-Match` requests. When the server
 * data hasn't changed, the browser HTTP cache serves the previous body off
 * a 304 + empty payload, so each "refetch" costs one round-trip plus ~50
 * bytes. TanStack's existing cached data stays put on a successful 304
 * response, so consumers don't see a flash.
 *
 * - `staleTime`: tunable freshness budget. Anything within this window is
 *   served from TanStack's cache with no network traffic at all; older
 *   queries trigger the conditional refetch.
 * - `gcTime: Infinity`: keep entries around even when no component is
 *   observing them — otherwise the boot warm-up gets evicted by the global
 *   10-minute default if the user takes a break before opening a cafe page.
 * - `refetchOnWindowFocus: true`: focus is a natural "did anything change
 *   while I was away?" trigger. Now that revalidation is cheap, the
 *   global default-off no longer applies.
 */
export const etagRevalidatingQueryOptions = {
    staleTime:            5 * 60 * 1000,
    gcTime:               Infinity,
    refetchOnWindowFocus: true,
} as const;
