import { IGroupMember } from '@msdining/common/models/group';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../../../context/app.js';
import { getViewName } from '../../../../../util/cafe.js';

interface ICafeDisplayProps {
    cafeId: string;
}

const CafeDisplay: React.FC<ICafeDisplayProps> = ({ cafeId }) => {
    const { viewsById } = useContext(ApplicationContext);
    const cafeView = viewsById.get(cafeId);

    if (!cafeView) {
        return <span>Unknown Cafe ({cafeId})</span>;
    }

    return (
        <span>
            Cafe:
            {
                getViewName({
                    view: cafeView,
                    showGroupName: true,
                    includeEmoji: true
                })
            } 
        </span>
    );
}

interface IGroupMemberProps {
    member: IGroupMember;
}

export const GroupMember: React.FC<IGroupMemberProps> = ({ member }) => {
    return (
        <div className="flex-col align-center">
            {
                member.imageUrl && <img src={member.imageUrl} loading="lazy" alt={`Member image URL for ${member.name} (${member.id})`} style={{ maxWidth: '5rem' }}/>
            }
            <span>
                {member.name}
            </span>
            <CafeDisplay cafeId={member.cafeId}/>
            {
                member.metadata && (
                    <>
                        {
                            Object.entries(member.metadata).map(([key, value]) => value && (
                                <div key={key} className="flex flex-between">
                                    <span>{key}:</span>
                                    <span>
                                        {key === 'stationLogoUrl' ? <img src={value} loading="lazy" alt="<station logo img>" style={{ maxWidth: '3rem' }}/> : String(value)}
                                    </span>
                                </div>
                            ))
                        }
                    </>
                )
            }
        </div>
    );
}