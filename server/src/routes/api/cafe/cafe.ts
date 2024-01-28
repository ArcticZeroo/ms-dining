import Router from '@koa/router';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import * as diningConfig from '../../../constants/cafes.js';
import { ApplicationContext } from '../../../constants/context.js';
import { IDiningCoreGroup, IDiningCoreGroupMember, IDiningCoreResponse } from '@msdining/common/dist/models/http.js';
import { getLogoUrl } from '../../../util/cafe.js';
import { isCafeAvailable } from '../../../util/date.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { registerMenuRoutes } from './menu.js';
import { registerSearchRoutes } from './search.js';
import { registerOrderingRoutes } from './ordering.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import Duration from '@arcticzeroo/duration';

export const registerCafeRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    registerMenuRoutes(router);
    registerSearchRoutes(router);
    registerOrderingRoutes(router);

    router.get('/',
        memoizeResponseBodyByQueryParams(),
        async ctx => {
            const response: IDiningCoreResponse = {
                isTrackingEnabled: ApplicationContext.isReadyForTracking,
                groups:            []
            };

            const cafeDataById = await CafeStorageClient.retrieveCafesAsync();

            for (const group of diningConfig.groupList) {
                const responseGroup: IDiningCoreGroup = {
                    name:         group.name,
                    id:           group.id,
                    number:       group.number,
                    alwaysExpand: group.alwaysExpand ?? false,
                    members:      [],
                    location:     group.location
                };

                for (const cafe of group.members) {
                    // Allows us to add cafes before they've officially opened, without polluting the menu list.
                    // For instance, when Food Hall 4 was added, the online ordering menu became available more than
                    // a week early.
                    if (!isCafeAvailable(cafe)) {
                        continue;
                    }

                    const cafeData = cafeDataById.get(cafe.id);
                    if (!cafeData) {
                        // Expected in case we have a cafe in config which isn't available online for some reason
                        continue;
                    }

                    const member: IDiningCoreGroupMember = {
                        name:     cafe.name,
                        id:       cafe.id,
                        number:   cafe.number,
                        url:      cafe.url,
                        logoUrl:  getLogoUrl(cafe, cafeData),
                        location: cafe.location
                    };

                    // @ts-expect-error: TS doesn't know that we have already enforced the location requirement
                    responseGroup.members.push(member);
                }

                response.groups.push(responseGroup);
            }

            ctx.body = jsonStringifyWithoutNull(response);
        });

    attachRouter(parent, router);
};