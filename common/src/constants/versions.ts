// When it has been a while after the version tag has been updated,
// we can "deprecate" it by commenting it out to force build failure.
export const VERSION_TAG = {
	unknown: 0,
	// modifiersInSearchResults: 1,
	// unreleasedCafes: 2,
	// searchResultsNotHereThisWeek: 3,
    // userNotInCafeList: 4,
    // featuredInOverview: 5,
	menuRouteIsObjectInsteadOfArray: 6,
};

export const VERSION_TAG_HEADER = 'X-Client-Version-Tag';