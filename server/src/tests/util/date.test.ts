import { ICafe } from '../../models/cafe.js';
import { isCafeAvailable } from '../../util/date.js';
import { fromDateString } from '@msdining/common/dist/util/date-util.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('isCafeAvailable', () => {
	it('returns true when cafe has no firstAvailable date', () => {
		const cafe: ICafe = {
			name: 'Test Cafe',
			id: 'test',
		};

		assert(isCafeAvailable(cafe));
	});

	it('return true when cafe is available (fixed date)', () => {
		const now = fromDateString('2022-01-01');
		const firstAvailable = fromDateString('2021-01-01');

		const cafe: ICafe = {
			name: 'Test Cafe',
			id: 'test',
			firstAvailable
		};

		assert(isCafeAvailable(cafe, now));
	});

	it('returns false when cafe is not available (fixed date)', () => {
		const now = fromDateString('2021-01-01');
		const firstAvailable = fromDateString('2022-01-01');

		const cafe: ICafe = {
			name: 'Test Cafe',
			id: 'test',
			firstAvailable
		};

		assert(!isCafeAvailable(cafe, now));
	});

	it('returns true when cafe is available (automatic date=now)', () => {
		const firstAvailable = new Date();
		firstAvailable.setMonth(firstAvailable.getMonth() - 1);

		const cafe: ICafe = {
			name: 'Test Cafe',
			id: 'test',
			firstAvailable
		};

		assert(isCafeAvailable(cafe));
	});

	it('returns false when cafe is not available (automatic date=now)', () => {
		const firstAvailable = new Date();
		firstAvailable.setMonth(firstAvailable.getMonth() + 1);

		const cafe: ICafe = {
			name: 'Test Cafe',
			id: 'test',
			firstAvailable
		};

		assert(!isCafeAvailable(cafe));
	});
});