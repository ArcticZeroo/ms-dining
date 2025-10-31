import { useValueNotifier } from '../../../../hooks/events.ts';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { GroupListBody } from './group-list-body.js';

export const GroupList = () => {
    const { value: groupList } = useValueNotifier(GROUP_STORE.groups);

    const titleSuffix = groupList ? ` (${groupList.size})` : '';

    return (
        <>
            <div>
                Group List{titleSuffix}
            </div>
            <GroupListBody/>
        </>
    );
}