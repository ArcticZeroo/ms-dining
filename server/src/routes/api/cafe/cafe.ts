import Router from '@koa/router';
import { VERSION_TAG } from '@msdining/common/dist/constants/versions.js';
import { IDiningCoreGroup, IDiningCoreGroupMember, IDiningCoreResponse } from '@msdining/common/dist/models/http.js';
import { getMinimumDateForMenu, toMaybeDateString } from '@msdining/common/dist/util/date-util.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import * as diningConfig from '../../../constants/cafes.js';
import { ApplicationContext } from '../../../constants/context.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { getLogoUrl } from '../../../util/cafe.js';
import { isCafeAvailable } from '../../../util/date.js';
import { attachRouter, supportsVersionTag } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { registerMenuRoutes } from './menu.js';
import { registerOrderingRoutes } from './ordering.js';
import { registerSearchRoutes } from './search.js';
import { logDebug } from '../../../util/log.js';

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
				isTrackingEnabled: ApplicationContext.analyticsApplicationsReady.size > 0,
				groups:            []
			};

			const cafeDataById = await CafeStorageClient.retrieveCafesAsync();

			for (const group of diningConfig.groupList) {
				const responseGroup: IDiningCoreGroup = {
					name:         group.name,
					id:           group.id,
					shortName:    group.shortName,
					alwaysExpand: group.alwaysExpand ?? false,
					members:      [],
					location:     group.location
				};

				for (const cafe of group.members) {
					// Allows us to add cafes before they've officially opened, without polluting the menu list.
					// For instance, when Food Hall 4 was added, the online ordering menu became available more than
					// a week early.
					if (!supportsVersionTag(ctx, VERSION_TAG.unreleasedCafes) && !isCafeAvailable(cafe, getMinimumDateForMenu())) {
						logDebug(`Skipping cafe ${cafe.id} because it is not yet available & client does not support unreleased cafes`);
						continue;
					}

					const cafeData = cafeDataById.get(cafe.id);
					if (!cafeData) {
						// Expected in case we have a cafe in config which isn't available online for some reason
						continue;
					}

					const member: IDiningCoreGroupMember = {
						name:               cafe.name,
						id:                 cafe.id,
						shortName:          cafe.shortName,
						url:                cafe.url,
						logoUrl:            getLogoUrl(cafe, cafeData),
						location:           cafe.location,
						emoji:              cafe.emoji,
						firstAvailableDate: toMaybeDateString(cafe.firstAvailable)
					};

					// @ts-expect-error: TS doesn't know that we have already enforced the location requirement
					// in the original definition of the group
					responseGroup.members.push(member);
				}

				response.groups.push(responseGroup);
			}

			ctx.body = jsonStringifyWithoutNull(response);
		});

	attachRouter(parent, router);
};