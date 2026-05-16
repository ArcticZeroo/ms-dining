import { useItemsWithoutGroup, useZeroContextCandidates } from '../../../../store/queries/groups.ts';
import { useMemo } from 'react';
import { GroupZeroContextCandidateListBody } from './group-zero-context-candidate-list-body.js';
import './groups.css';

export const GroupZeroContextCandidateList= () => {
    // Pre-warm items-without-group so candidate accept doesn't need to refetch
    // it when patching the cache.
    useItemsWithoutGroup();

    const { data: candidates } = useZeroContextCandidates();
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