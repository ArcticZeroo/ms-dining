import { useGroups } from '../../../../store/queries/groups.ts';
import { GroupListBody } from './group-list-body.js';
import './groups.css';

export const GroupList = () => {
    const { data: groupList } = useGroups();
    const titleSuffix = groupList ? ` (${groupList.size})` : '';

    return (
        <div className="flex-col">
            <div>
                Group List{titleSuffix}
            </div>
            <GroupListBody/>
        </div>
    );
}