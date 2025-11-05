import { useValueNotifier } from '../../../../hooks/events.ts';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { useMemo } from 'react';
import { GroupZeroContextCandidateListBody } from './group-zero-context-candidate-list-body.js';

export const GroupZeroContextCandidateList= () => {
    const { value: candidates } = useValueNotifier(GROUP_STORE.zeroContextCandidates);
    const candidateCount = useMemo(
        () => candidates
            ? Array.from(candidates.values()).length
            : undefined,
        [candidates]
    );

    let title = 'Suggested Groups';
    if (candidateCount) {
        title += ` (${candidateCount})`;
    }

    return (
        <div className="flex-col">
            <div>
                {title}
            </div>
            <GroupZeroContextCandidateListBody/>
        </div>
    );
}