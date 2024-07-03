import { isDuckType } from '@arcticzeroo/typeguard';
import { IAvailabilityPattern } from '../models/pattern.js';

interface ISerializedPattern {
	start: number;
	gap: number;
	weekdays: number[];
}

export const patternToString = (pattern: IAvailabilityPattern): string => {
	const serializedPattern: ISerializedPattern = {
		start:    pattern.startDate.getTime(),
		gap:      pattern.gap,
		weekdays: Array.from(pattern.weekdays)
	};

	return JSON.stringify(serializedPattern);
}

export const stringToPattern = (ruleString: string): IAvailabilityPattern => {
	const rule = JSON.parse(ruleString);

	if (!isDuckType<ISerializedPattern>(rule, { start: 'number', gap: 'number', weekdays: 'object' })) {
		throw new Error('Invalid pattern string');

	}

	return {
		startDate: new Date(rule.start),
		gap:       rule.gap,
		weekdays:  new Set(rule.weekdays)
	};
}

export const isEveryDayPattern = (pattern: IAvailabilityPattern): boolean => pattern.gap === 1 && pattern.weekdays.size === 5;