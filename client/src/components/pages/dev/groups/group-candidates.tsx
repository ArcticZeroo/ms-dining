import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupCandidatesZeroContext } from '../../../../api/client/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupCandidate } from './group-candidate.js';
import { useEffect, useState } from 'react';
import { IGroupData } from '@msdining/common/models/group';

export const GroupCandidates = () => {
    const { stage, value: candidates, error, run: retry } = useImmediatePromiseState(retrieveGroupCandidatesZeroContext);
    const [localCandidates, setLocalCandidates] = useState<Array<IGroupData>>([]);

    useEffect(() => {
        setLocalCandidates(candidates ?? []);
    }, [candidates]);

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

    if (stage === PromiseStage.success) {
        if (localCandidates.length === 0) {
            return (
                <div>
                    There are no group candidates at this time.
                </div>
            );
        }

        const candidateEntries = [...localCandidates];
        candidateEntries.sort((a, b) => a.name.localeCompare(b.name));

        return (
            <div className="flex-col">
                {
                    candidateEntries.map((group) => (
                        <GroupCandidate
                            key={`${group.type}-${group.name}`}
                            group={group}
                            onAcceptedAll={() => {
                                setLocalCandidates(localCandidates.filter(localCandidate => localCandidate.id !== group.id));
                            }}
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