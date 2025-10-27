import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupCandidatesZeroContext } from '../../../../api/client/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GroupCandidate } from './group-candidate.js';
import { useEffect, useState } from 'react';
import { IGroupMember } from '@msdining/common/models/group';
import { getRandomId } from '../../../../util/id.js';

interface ICandidateData {
    id: string;
    name: string;
    members: Array<IGroupMember>;
}

export const GroupCandidates = () => {
    const { stage, value: candidates, error, run: retry } = useImmediatePromiseState(retrieveGroupCandidatesZeroContext);
    const [localCandidates, setLocalCandidates] = useState<Array<ICandidateData>>([]);

    useEffect(() => {
        const newCandidates = candidates ?? [];
        setLocalCandidates(newCandidates.map(([name, members]) => ({ name, members, id: getRandomId() })));
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
                    candidateEntries.map(({ name, members, id }) => (
                        <GroupCandidate
                            key={`${members[0]?.type}-${name}`}
                            name={name}
                            members={members}
                            onAcceptedAll={() => {
                                setLocalCandidates(localCandidates.filter(localCandidate => localCandidate.id !== id));
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