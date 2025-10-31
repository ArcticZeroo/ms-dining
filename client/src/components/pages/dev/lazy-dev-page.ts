import React from 'react';

export const LazyDevPage = React.lazy(() => import('./dev-page.js').then((module) => ({ default: module.DevPage })));
