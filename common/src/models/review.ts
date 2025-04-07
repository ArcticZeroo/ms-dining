export interface IReviewDTO {
	id: string;
	userId: string;
	userDisplayName: string;
	menuItemId: string;
	cafeId: string;
	rating: number;
	comment?: string;
	createdAt: number;
}

export interface IReview {
	id: string;
	userId: string;
	userDisplayName: string;
	menuItemId: string;
	cafeId: string;
	rating: number;
	comment?: string;
	createdAt: Date;
}