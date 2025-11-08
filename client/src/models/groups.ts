import { SearchEntityType } from '@msdining/common/models/search';
import { IGroupMember } from '@msdining/common/models/group';

export type AllItemsWithoutGroupByType = Map<SearchEntityType, Map<string /*memberId*/, IGroupMember>>;