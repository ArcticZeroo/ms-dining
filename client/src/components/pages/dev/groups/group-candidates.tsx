import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupCandidatesZeroContext } from '../../../../api/client/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupCandidate } from './group-candidate.js';

export const GroupCandidates = () => {
    const { value: candidates, error, run: retry } = useImmediatePromiseState(retrieveGroupCandidatesZeroContext);

    if (error) {
        return (
            <div>
                <span>
                    Unable to load group candidates. Please try again.
                </span>
                <RetryButton onClick={retry}/>
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

        const candidateEntries = Array.from(candidates.entries());
        candidateEntries.sort((a, b) => a[0].localeCompare(b[0]));

        return (
            <div className="flex-col">
                {
                    candidateEntries.map(([name, members]) => (
                        <GroupCandidate key={`${members[0]?.type}-${name}`} name={name} members={members}/>
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