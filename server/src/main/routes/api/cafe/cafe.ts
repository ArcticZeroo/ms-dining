import Router, { RouterContext } from '@koa/router';
import { IDiningCoreGroup, IDiningCoreGroupMember, IDiningCoreResponse } from '@msdining/common/models/http';
import { toMaybeDateString } from '@msdining/common/util/date-util';
import { getServices } from '../../../../shared/services/registry.js';
import * as diningConfig from '../../../../shared/constants/cafes.js';
import { ApplicationContext } from '../../../../shared/constants/context.js';
import { getLogoUrl } from '../../../../shared/util/cafe.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { registerMenuRoutes } from './menu.js';
import { registerOrderingRoutes } from './ordering.js';
import { registerSearchRoutes } from './search.js';
import { registerRecommendationsRoutes } from './recommendations.js';
import { registerGroupsRoutes } from './groups.js';
import { registerCartRoutes } from './cart.js';
import { memoizeResponseBody } from '../../../middleware/cache.js';

export const registerCafeRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    registerMenuRoutes(router);
    registerSearchRoutes(router);
    registerOrderingRoutes(router);
    registerRecommendationsRoutes(router);
    registerGroupsRoutes(router);
    registerCartRoutes(router);

    const populateCafesAsync = async (ctx: RouterContext, response: IDiningCoreResponse) => {
        const cafeDataById = await getServices().data.cafe.retrieveCafes({});

        for (const group of diningConfig.CAFE_GROUP_LIST) {
            const responseGroup: IDiningCoreGroup = {
                name:         group.name,
                id:           group.id,
                shortName:    group.shortName,
                aliases:      group.aliases,
                alwaysExpand: group.alwaysExpand ?? false,
                members:      [],
                location:     group.location
            };

            for (const cafe of group.members) {
                const cafeData = cafeDataById[cafe.id];
                if (!cafeData) {
                    // Expected in case we have a cafe in config which isn't available online for some reason
                    continue;
                }

                const member: IDiningCoreGroupMember = {
                    name:               cafe.name,
                    id:                 cafe.id,
                    shortName:          cafe.shortName,
                    aliases:            cafe.aliases,
                    url:                cafe.url,
                    logoUrl:            getLogoUrl(cafe, cafeData),
                    location:           cafe.location,
                    emoji:              cafe.emoji,
                    firstAvailableDate: toMaybeDateString(cafe.firstAvailable),
                };

                // @ts-expect-error: TS doesn't know that we have already enforced the location requirement
                // in the original definition of the group
                responseGroup.members.push(member);
            }

            response.groups.push(responseGroup);
        }
    }

    router.get('/',
        memoizeResponseBody(),
        async ctx => {
            const response: IDiningCoreResponse = {
                isTrackingEnabled: ApplicationContext.analyticsApplicationsReady.size > 0,
                groups:            []
            };

            await populateCafesAsync(ctx, response);

            ctx.body = jsonStringifyWithoutNull(response);
        });

    attachRouter(parent, router);
};
