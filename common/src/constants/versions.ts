export const VERSION_TAG = {
	unknown: 0,
	modifiersInSearchResults: 1,
};

export const VERSION_TAG_HEADER = 'X-Client-Version-Tag';

export const supportsModifiersInSearchResults = (version: number) => version >= VERSION_TAG.modifiersInSearchResults;