import { DiningHallView, DiningHallViewType, IDiningHall } from '../models/dining-halls';

export const expandAndFlattenView = (view: DiningHallView | string, viewsById: Map<string, DiningHallView>): Array<IDiningHall> => {
	if (typeof view === 'string') {
		const viewId = view;
		view = viewsById.get(viewId);
		if (!view) {
			throw new Error(`Missing view with id ${viewId}`);
		}
	}

	if (view.type === DiningHallViewType.single) {
		return [view.value];
	}

	return view.value.members.flatMap(viewId => expandAndFlattenView(viewId, viewsById));
}

export const generateDiningHallIds = function*(viewsById: Map<string, DiningHallView>) {
	for (const [viewId, view] of viewsById) {
		if (view.type === DiningHallViewType.single) {
			yield viewId;
		}
	}
}

export const getParentView = (viewsById: Map<string, DiningHallView>, useGroups: boolean, view: DiningHallView) => {
	if (view.type === DiningHallViewType.group) {
		return view;
	}

	if (!view.value.group || !useGroups) {
		return view;
	}

	return viewsById.get(view.value.group);
}
