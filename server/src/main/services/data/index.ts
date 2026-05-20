import { searchQueryService } from './search-query.js';
import { tagService } from './tag.js';
import { cafeService } from './cafe.js';
import { stationService } from './station.js';
import { userService } from './user.js';
import { stationThemeService } from './station-theme.js';
import { sessionService } from './session.js';
import { reviewService } from './review.js';
import { groupsService } from './groups.js';

/**
 * Composite of all main-side typed data-service clients. Lives at
 * `Services['data']` so callers reach them via
 * `getServices().data.searchQuery.x(...)`.
 *
 * Tests can override individual services per-context by spreading
 * `{ ...defaultDataServices, searchQuery: myStubService }` into the
 * services bag they install.
 */
export interface DataServices {
    searchQuery: typeof searchQueryService;
    tag: typeof tagService;
    cafe: typeof cafeService;
    station: typeof stationService;
    user: typeof userService;
    stationTheme: typeof stationThemeService;
    session: typeof sessionService;
    review: typeof reviewService;
    groups: typeof groupsService;
}

export const defaultDataServices: DataServices = {
    searchQuery:  searchQueryService,
    tag:          tagService,
    cafe:         cafeService,
    station:      stationService,
    user:         userService,
    stationTheme: stationThemeService,
    session:      sessionService,
    review:       reviewService,
    groups:       groupsService,
};

export { searchQueryService } from './search-query.js';
export { tagService } from './tag.js';
export { cafeService } from './cafe.js';
export { stationService } from './station.js';
export { userService } from './user.js';
export { stationThemeService } from './station-theme.js';
export { sessionService } from './session.js';
export { reviewService } from './review.js';
export { groupsService } from './groups.js';
