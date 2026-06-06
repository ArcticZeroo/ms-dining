export const ENTITY_KEY_GROUP_PREFIX = 'group:';
export const ENTITY_KEY_NAME_PREFIX = 'name:';

/**
 * Build an entity key from a pre-normalized name + optional groupId.
 *
 * Production reads should prefer the materialized `entityKey` column on
 * `MenuItem` / `Station` rows. This helper exists for the narrow set of
 * call sites that hold raw `(groupId, normalizedName)` parts but no full
 * row — e.g. cache invalidation event handlers, search-result review
 * lookups, and the buy-ondemand menu converter where the row hasn't been
 * persisted yet.
 */
export const getEntityKeyFromParts = (groupId: string | null | undefined, normalizedName: string): string => {
	if (groupId) {
		return ENTITY_KEY_GROUP_PREFIX + groupId;
	}
	return ENTITY_KEY_NAME_PREFIX + normalizedName;
};
