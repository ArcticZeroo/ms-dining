export interface IServerReview {
	id: string;
	rating: number;
	comment: string | null;
	createdAt: Date;
	userId: string;
	menuItemId: string;
	menuItemNormalizedName: string;
	user: {
		displayName: string;
	};
	menuItem: {
		name: string;
		groupId: string | null;
		cafe: {
			id: string;
		};
	};
}
