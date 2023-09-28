import { CafeView } from '../models/cafe.ts';

export const getViewUrl = (view: CafeView) => `/menu/${view.value.id}`;