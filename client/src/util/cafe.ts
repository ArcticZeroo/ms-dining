import { ICafe } from '../models/cafe.ts';

export const getCafeName = (cafe: ICafe, showGroupName: boolean) => {
	if (!showGroupName || !cafe.group) {
		return cafe.name;
	}

	const groupName = cafe.group.name;

	if (cafe.name === groupName) {
		return cafe.name;
	}

	return `${cafe.name} (${groupName})`;
}