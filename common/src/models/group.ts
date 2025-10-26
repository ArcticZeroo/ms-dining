import { SearchEntityType } from './search.js';

export interface IGroupCandidate {
	name: string;
	id: string;
	type: SearchEntityType;
}
