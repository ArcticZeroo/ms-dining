import { IGroupMember } from '@msdining/common/models/group';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../../../context/app.js';
import { getViewName } from '../../../../../util/cafe.js';
import { GroupMemberMetadataRow } from './group-member-metadata-row.tsx';

interface ICafeDisplayProps {
    cafeId: string;
}

const CafeDisplay: React.FC<ICafeDisplayProps> = ({ cafeId }) => {
    const { viewsById } = useContext(ApplicationContext);
    const cafeView = viewsById.get(cafeId);

    return (
        <span className="flex">
            <span>
                Cafe:
            </span>
            <span>
                {
                    !cafeView && `Unknown (${cafeId})`
                }
                {
                    cafeView && getViewName({
                        view: cafeView,
                        showGroupName: true,
                        includeEmoji: true
                    })
                } 
            </span>
        </span>
    );
}

interface IGroupMemberProps {
    member: IGroupMember;
}

// eslint-disable-next-line react/no-multi-comp -- CafeDisplay is a tiny co-located sub-display used only here
export const GroupMember: React.FC<IGroupMemberProps> = ({ member }) => {
    return (
        <div className="flex-col align-center flex-around">
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
                                <GroupMemberMetadataRow key={key} metadataKey={key} value={value}/>
                            ))
                        }
                    </>
                )
            }
        </div>
    );
}