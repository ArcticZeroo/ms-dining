import { CafeView } from '../models/cafe.ts';

export const getViewMenuUrl = (view: CafeView) => `/menu/${view.value.id}`;

export const getViewMenuUrlWithJump = (parentView: CafeView, view: CafeView) => `${getViewMenuUrl(parentView)}#${view.value.id}`;