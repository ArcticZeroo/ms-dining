import { searchQueryServiceCommands } from './storage/clients/search/search-query-commands.js';
import { tagServiceCommands } from './storage/clients/tags/tags-commands.js';
import { cafeServiceCommands } from './storage/clients/cafe/cafe-commands.js';
import { stationServiceCommands } from './storage/clients/station/station-commands.js';
import { userServiceCommands } from './storage/clients/user/user-commands.js';
import { stationThemeServiceCommands } from './storage/clients/station/station-theme-commands.js';
import { sessionServiceCommands } from '../../main/util/session-store.js';
import { reviewServiceCommands } from './storage/clients/review/review-commands.js';
import { groupsServiceCommands } from './storage/clients/groups/groups-commands.js';
import { menuItemServiceCommands } from './storage/clients/menu-item/menu-item-commands.js';
import { dailyMenuServiceCommands } from './storage/clients/daily-menu/daily-menu-commands.js';
import { searchServiceCommands } from './storage/clients/search/search-service-commands.js';
import { menuAnalyticsServiceCommands } from './storage/clients/analytics/menu-analytics-commands.js';
import { cartServiceCommands } from './storage/clients/cart/cart-commands.js';
import { orderServiceCommands } from './storage/clients/order/order-commands.js';

export const DATA_SERVICES = {
    searchQuery:  searchQueryServiceCommands,
    tag:          tagServiceCommands,
    cafe:         cafeServiceCommands,
    station:      stationServiceCommands,
    user:         userServiceCommands,
    stationTheme: stationThemeServiceCommands,
    session:      sessionServiceCommands,
    review:       reviewServiceCommands,
    groups:       groupsServiceCommands,
    menuItem:     menuItemServiceCommands,
    dailyMenu:    dailyMenuServiceCommands,
    search:       searchServiceCommands,
    menuAnalytics: menuAnalyticsServiceCommands,
    cart:         cartServiceCommands,
    order:        orderServiceCommands,
} as const;

export type DataServiceMap = typeof DATA_SERVICES;
