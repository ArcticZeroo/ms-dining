import Router from '@koa/router';

export const attachRouter = (parent: Router, child: Router) => parent.use(child.routes(), child.allowedMethods());
