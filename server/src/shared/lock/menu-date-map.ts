import { LockedMap } from './map.js';
import { weakSetInterval } from '../util/timer.js';
import Duration from '@arcticzeroo/duration';
import { isDateStringWithinMenuWindow } from '../util/date.js';

const CLEANUP_INTERVAL = new Duration({ hours: 12 });

export class MenuDateLockedMap<V> extends LockedMap<string /*dateString*/, V> {
	constructor(initialState?: Iterable<[string, V]>) {
		super(initialState);

		weakSetInterval(this, CLEANUP_INTERVAL, (thisMap) => {
			thisMap.deleteWhere((dateString) => !isDateStringWithinMenuWindow(dateString))
				.catch(err => console.error('Failed to clean up date strings in MenuDateLockedMap', err));
		});
	}
}

export class MenuDateMap<V> extends Map<string, V> {
	constructor(initialState?: Iterable<[string, V]>) {
		super(initialState);

		weakSetInterval(this, CLEANUP_INTERVAL, (thisMap) => {
			for (const key of Array.from(thisMap.keys())) {
				if (!isDateStringWithinMenuWindow(key)) {
					thisMap.delete(key);
				}
			}
		});
	}
}