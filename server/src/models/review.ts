export interface IServerReview {
	id: string;
	rating: number;
	comment: string | null;
	displayName: string | null;
	createdAt: Date;
	userId: string | null;
	menuItemId: string | null;
	stationId: string | null;
	user: {
		displayName: string;
	} | null;
	menuItem: {
		name: string;
		normalizedName: string;
		groupId: string | null;
		cafe: {
			id: string;
		};
	} | null;
	station: {
		name: string;
		normalizedName: string;
		groupId: string | null;
		cafe: {
			id: string;
		};
	} | null;
}
