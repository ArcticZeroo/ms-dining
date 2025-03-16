export interface IAvailabilityPattern {
	startDate: Date;
	weekdays: Set<number>;
	gap: number;
}

export interface IEntityVisitData {
	dateString: string;
	cafeId: string;
}
