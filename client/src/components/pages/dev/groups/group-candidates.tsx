import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { retrieveGroupCandidatesZeroContext } from '../../../../api/client/groups.js';
import { RetryButton } from '../../../button/retry-button.js';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { GroupMember } from './group-member.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';

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
            <div>
                {
                    candidateEntries.map(([name, members]) => (
                        <Accordion key={`${members[0]!.type}-${name}`}>
                            <AccordionSummary>
                                {name} ({members.length})
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="flex flex-wrap">
                                    {members.map(member => (
                                        <GroupMember member={member} key={member.id} />
                                    ))}
                                </div>
                            </AccordionDetails>
                        </Accordion>
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