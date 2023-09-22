import { useEffect, useState } from 'react';
import {
	DiningHallView,
	DiningHallViewType,
	IDiningHall,
	IDiningHallGroupWithoutMembers
} from '../models/dining-halls';

export const useViewData = (diningHalls: IDiningHall[], groups: IDiningHallGroupWithoutMembers[]) => {
	const [viewsById, setViewsById] = useState<Map<string, DiningHallView>>(new Map());
	const [viewsInOrder, setViewsInOrder] = useState<Array<DiningHallView>>([]);

	useEffect(() => {
		const viewsById = new Map<string, DiningHallView>();

		for (const group of groups) {
			viewsById.set(group.id, {
				type: DiningHallViewType.group,
				value: {
					...group,
					members: []
				}
			});
		}

		for (const diningHall of diningHalls) {
			viewsById.set(diningHall.id, {
				type:  DiningHallViewType.single,
				value: diningHall
			});

			if (diningHall.group) {
				if (!viewsById.has(diningHall.group)) {
					throw new Error(`Missing dining hall group with id ${diningHall.group}`);
				}

				const groupView = viewsById.get(diningHall.group)!;
				if (groupView.type !== DiningHallViewType.group) {
					throw new Error(`View with id ${diningHall.group} has the wrong view type!`);
				}

				groupView.value.members.push(diningHall.id);
			}
		}

		setViewsById(viewsById);

		const viewIdsInOrder = Array.from(viewsById.keys()).sort();
		const viewsInOrder = viewIdsInOrder.map(viewId => viewsById.get(viewId)!);

		setViewsInOrder(viewsInOrder);
	}, [diningHalls, groups]);

	return { viewsById, viewsInOrder } as const;
}