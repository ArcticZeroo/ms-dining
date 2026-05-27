/**
 * Canonical tag IDs and their display names.
 *
 * When the upstream API provides a tag whose display name matches
 * a known tag (case-insensitive), we normalize it to the canonical
 * ID so duplicates are eliminated at parse time.
 */
export const KNOWN_TAG_DISPLAY_NAMES: Record<string, string> = {
	'low_circle':    'Low Emissions',
	'medium_circle': 'Medium Emissions',
	'high_circle':   'High Emissions',
	'vegan':         'Vegan',
	'vegetarian':    'Vegetarian',
	'gluten free':   'Gluten Free',
};

// Reverse map: lowercased display name → canonical tag ID
const displayNameToTagId = new Map(Object.entries(KNOWN_TAG_DISPLAY_NAMES).map(([tagId, name]) => [name.toLowerCase(), tagId]));

/**
 * If the tag name (case-insensitive) matches a known tag's display name,
 * returns the canonical tag ID. Otherwise returns the original tag name.
 */
export const normalizeTagName = (tagName: string): string => displayNameToTagId.get(tagName.toLowerCase()) ?? tagName;
