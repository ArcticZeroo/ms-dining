/**
 * Maps cryptic upstream tag IDs to human-readable canonical names.
 * Tags not in this map are kept as-is (they're already readable).
 */
const TAG_ID_TO_CANONICAL: Record<string, string> = {
    'low_circle':    'low emissions',
    'medium_circle': 'medium emissions',
    'high_circle':   'high emissions',
};

/**
 * Normalizes a tag name to its canonical form.
 * Converts cryptic API tag IDs (e.g. "low_circle") to readable names
 * (e.g. "low emissions"). Already-readable names pass through unchanged,
 * and duplicates collapse since both map to the same canonical name.
 */
export const normalizeTagName = (tagName: string): string =>
    TAG_ID_TO_CANONICAL[tagName] ?? tagName;

/**
 * Known tag display names, keyed by canonical tag name.
 * Used by client for rendering icons/colors, by server for normalization.
 */
export const KNOWN_TAG_NAMES: Record<string, string> = {
    'gluten free':      'Gluten Free',
    'vegan':            'Vegan',
    'vegetarian':       'Vegetarian',
    'low emissions':    'Low Emissions',
    'medium emissions': 'Medium Emissions',
    'high emissions':   'High Emissions',
};