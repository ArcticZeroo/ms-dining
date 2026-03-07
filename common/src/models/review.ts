export interface IReview {
	id: string;
	userId?: string;
	userDisplayName: string;
	menuItemId?: string;
	menuItemName?: string;
	stationId?: string;
	stationName?: string;
	cafeId: string;
	rating: number;
	comment?: string;
	createdDate: string;
}

export interface IReviewWithComment extends IReview {
	comment: string;
}

export interface IReviewSummary {
	counts: Record<number, number>;
	totalCount: number;
	overallRating: number;
	reviewsWithComments: IReviewWithComment[];
	myReview?: IReview;
}