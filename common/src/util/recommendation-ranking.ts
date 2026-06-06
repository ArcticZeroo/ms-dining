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

// ─── Review-popularity multiplier ───────────────────────────────────────
//
// Boosts items the community rates highly and demotes items the community
// rates poorly, scaled by how confident we are in the rating (review count).

/** Rating midpoint — ratings above this boost, below this demote. */
export const REVIEW_RATING_NEUTRAL = 5;
/** Maximum boost/penalty applied at perfect/zero ratings + high confidence. */
export const REVIEW_RATING_AMPLITUDE = 0.5;
/**
 * Review count at which we treat the rating as fully reliable.
 * Below this, confidence ramps up logarithmically.
 */
export const REVIEW_CONFIDENCE_REFERENCE_COUNT = 100;

/**
 * Bidirectional multiplier shaped by community review rating + confidence.
 * Returns 1 when there are no reviews so callers don't need to guard.
 *
 * Confidence grows as log10(1 + count) / log10(1 + REVIEW_CONFIDENCE_REFERENCE_COUNT),
 * capped at 1. Multiplier is then 1 + (rating − 5)/10 × amplitude × confidence,
 * which lands in [1 − amplitude, 1 + amplitude]. Tuned so a 5-star item with
 * ≥100 reviews caps at 1.5× and a 0-star item with ≥100 reviews bottoms at 0.5×;
 * a 5-star item with 1 review only nudges by a few percent.
 *
 * NB: when global per-item order counts become a more reliable popularity
 * signal than review counts, swap `totalReviewCount` for that input — the
 * multiplier shape stays the same.
 */
export const getReviewPopularityMultiplier = (overallRating: number, totalReviewCount: number): number => {
	if (totalReviewCount <= 0) {
		return 1;
	}
	// Rating range is 0-10 (mid = 5), so dividing by 5 makes the factor span [-1, 1].
	const ratingFactor = (overallRating - REVIEW_RATING_NEUTRAL) / 5;
	const confidence = Math.min(
		1,
		Math.log10(1 + totalReviewCount) / Math.log10(1 + REVIEW_CONFIDENCE_REFERENCE_COUNT),
	);
	return 1 + ratingFactor * REVIEW_RATING_AMPLITUDE * confidence;
};
