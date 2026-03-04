export interface IServerReview {
	id: string;
	rating: number;
	comment: string | null;
	displayName: string | null;
	createdAt: Date;
	userId: string | null;
	menuItemId: string;
	menuItemNormalizedName: string;
	user: {
		displayName: string;
	} | null;
	menuItem: {
		name: string;
		groupId: string | null;
		cafe: {
			id: string;
		};
	};
}
