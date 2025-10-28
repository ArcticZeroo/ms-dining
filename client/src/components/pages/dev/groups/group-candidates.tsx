import { useValueNotifier } from '../../../../hooks/events.ts';
import { GROUP_STORE } from '../../../../store/groups.ts';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupCandidate } from './group-candidate.js';

export const GroupCandidates = () => {
    const { value: candidates, error } = useValueNotifier(GROUP_STORE.groups);

    if (error) {
        return (
            <div>
                <span>
                    Unable to load group candidates. Please try again.
                </span>
                <RetryButton onClick={() => GROUP_STORE.refreshGroups()}/>
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
            <div className="flex-col">
                {
                    candidateEntries.map((group) => (
                        <GroupCandidate
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