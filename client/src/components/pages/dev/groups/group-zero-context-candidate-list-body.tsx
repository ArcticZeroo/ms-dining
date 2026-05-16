import { useZeroContextCandidates } from '../../../../store/queries/groups.ts';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupZeroContextCandidateListItem } from './group-zero-context-candidate-list-item.js';

export const GroupZeroContextCandidateListBody = () => {
    const { data: candidates, error, refetch } = useZeroContextCandidates();

    if (error) {
        return (
            <div>
                <span>
                    Unable to load group candidates. Please try again.
                </span>
                <RetryButton onClick={() => refetch()}/>
            </div>
        );
    }

    if (candidates) {
        if (candidates.size === 0) {
            return (
                <div>
                    There are no group candidates at this time.
                </div>
            );
        }

        const candidateEntries = [...candidates.values()];
        candidateEntries.sort((a, b) => a.name.localeCompare(b.name));

        return (
            <div className="flex-col group-list-vertical-scroll">
                {
                    candidateEntries.map((group) => (
                        <GroupZeroContextCandidateListItem
                            key={`${group.type}-${group.name}`}
                            group={group}
                        />
                    ))
                }
            </div>
        );
    }

    return (
        <div className="flex">
            <HourglassLoadingSpinner/>
            <span>
                Loading group candidates...
            </span>
        </div>
    );
}