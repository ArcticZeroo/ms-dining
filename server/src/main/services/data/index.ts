import { searchQueryService } from './search-query.js';
import { tagService } from './tag.js';

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
}

export const defaultDataServices: DataServices = {
    searchQuery: searchQueryService,
    tag:         tagService,
};

export { searchQueryService } from './search-query.js';
export { tagService } from './tag.js';
