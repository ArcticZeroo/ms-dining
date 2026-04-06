import Router from '@koa/router';
import { registerMenuItemReviewRoutes } from './menu-item-reviews.js';
import { registerReviewCrudRoutes } from './review-crud.js';
import { registerStationReviewRoutes } from './station-reviews.js';

export const registerReviewRoutes = (parent: Router) => {
    registerMenuItemReviewRoutes(parent);
    registerReviewCrudRoutes(parent);
    registerStationReviewRoutes(parent);
};
