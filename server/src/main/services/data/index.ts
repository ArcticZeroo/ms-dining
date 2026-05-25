import { createDataServices, type DataServices } from '../../../shared/services/create-data-services.js';
import { dataHandler } from './handler.js';
import { DATA_SERVICES } from '../../../worker/data/data-services.js';

/**
 * Composite of all typed data-service clients. Lives at `Services['data']`
 * so callers reach them via `getServices().data.searchQuery.x(...)`.
 *
 * Tests can override individual services per-context by spreading
 * `{ ...defaultDataServices, searchQuery: myStubService }` into the
 * services bag they install.
 */
export type { DataServices } from '../../../shared/services/create-data-services.js';

export const defaultDataServices: DataServices = createDataServices(dataHandler, DATA_SERVICES);

export { searchQueryService } from './search-query.js';
export { tagService } from './tag.js';
export { cafeService } from './cafe.js';
export { stationService } from './station.js';
export { userService } from './user.js';
export { stationThemeService } from './station-theme.js';
export { sessionService } from './session.js';
export { reviewService } from './review.js';
export { groupsService } from './groups.js';
export { menuItemService } from './menu-item.js';
export { dailyMenuService } from './daily-menu.js';
export { searchService } from './search-service.js';
export { menuAnalyticsService } from './menu-analytics.js';
export { cartService } from './cart.js';
export { orderService } from './order.js';
