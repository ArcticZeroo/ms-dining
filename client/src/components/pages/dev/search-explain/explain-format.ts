export const formatNumber = (value: number | null, digits = 3): string =>
    value == null ? 'n/a' : value.toFixed(digits);

/** Cosine similarity from a cosine distance (sqlite-vec distance is in [0, 2]). */
export const similarityFromDistance = (distance: number | null): number | null =>
    distance == null ? null : 1 - distance;
