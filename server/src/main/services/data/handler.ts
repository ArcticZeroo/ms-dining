import { InProcessHandler } from '../../../worker/rpc/handler.js';
import { searchQueryServiceCommands } from '../../../api/storage/clients/search-query.js';
import { tagServiceCommands } from '../../../api/storage/clients/tags.js';
import { cafeServiceCommands } from '../../../api/storage/clients/cafe.js';
import { stationServiceCommands } from '../../../api/storage/clients/station.js';
import { userServiceCommands } from '../../../api/storage/clients/user.js';
import { stationThemeServiceCommands } from '../../../api/storage/clients/station-theme.js';
import { sessionServiceCommands } from '../../util/session-store.js';
import { reviewServiceCommands } from '../../../api/storage/clients/review.js';
import { groupsServiceCommands } from '../../../api/storage/clients/groups.js';
import { menuItemServiceCommands } from '../../../api/storage/clients/menu-item.js';

/**
 * Single source of truth for which worker-side service command bags are
 * registered with the data handler. As each domain service migrates in
 * phase 1, add one line here.
 *
 * In phase 2 this composition moves into the worker-db entry file
 * (`src/worker-db/entry.ts`), and `dataHandler` below switches from
 * `InProcessHandler` to `WorkerThreadHandler` pointed at that entry. The
 * shape of `DATA_SERVICES` is identical in both modes — that's the whole
 * point of writing it once here.
 */
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
} as const;

export type DataServiceMap = typeof DATA_SERVICES;

/**
 * Phase 1 data handler: dispatches in-process via `InProcessHandler`.
 * structuredClone'd args + results catch any cross-boundary serialization
 * mistakes now, so phase 2's switch to `WorkerThreadHandler` is a one-line
 * change with no behavior regressions.
 */
export const dataHandler = new InProcessHandler<DataServiceMap>(DATA_SERVICES);
