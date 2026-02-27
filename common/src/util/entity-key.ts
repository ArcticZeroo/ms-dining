import { Nullable } from '../models/util.js';
import { normalizeNameForSearch } from './search-util.js';

export const ENTITY_KEY_GROUP_PREFIX = 'group:';
export const ENTITY_KEY_NAME_PREFIX = 'name:';

export const getEntityKey = (item: { groupId?: Nullable<string>; name: string }): string => {
	if (item.groupId) {
		return ENTITY_KEY_GROUP_PREFIX + item.groupId;
	}
	return ENTITY_KEY_NAME_PREFIX + normalizeNameForSearch(item.name);
};

export const getEntityKeyFromParts = (groupId: string | null | undefined, normalizedName: string): string => {
	if (groupId) {
		return ENTITY_KEY_GROUP_PREFIX + groupId;
	}
	return ENTITY_KEY_NAME_PREFIX + normalizedName;
};
