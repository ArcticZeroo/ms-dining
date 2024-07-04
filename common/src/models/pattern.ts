export interface IAvailabilityPattern {
	startDate: Date;
	weekdays: Set<number>;
	gap: number;
}