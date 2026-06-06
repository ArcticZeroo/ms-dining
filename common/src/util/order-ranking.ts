/**
 * Ranking utilities shared between the client (search-result sorting,
 * recommendation re-ranking) and the server (recommendation weighting).
 *
 * Kept in `common/` so the boost formula is defined exactly once — change
 * the shape here and every surface follows.
 */

/**
 * Gentle log-shaped multiplier used to boost ranking for items the user has
 * ordered before. Returns 1 when `count <= 0` so callers don't need to guard.
 *
 * The boost is intentionally subtle so a single past order can't overwhelm
 * other relevance signals (review score, vector distance, freshness, etc.).
 * Empirical shape:
 *   count=0  → 1×
 *   count=1  → ~1.21×
 *   count=3  → ~1.42×
 *   count=10 → ~1.72×
 *   count=30 → ~2.03×
 */
export const ORDER_HISTORY_BOOST_FACTOR = 0.3;

export const getOrderHistoryBoostMultiplier = (count: number): number => {
	if (count <= 0) {
		return 1;
	}
	return 1 + Math.log(1 + count) * ORDER_HISTORY_BOOST_FACTOR;
};
