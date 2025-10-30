import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';

interface IGroupMemberProps {
    member: IGroupMember;
}

export const GroupMember: React.FC<IGroupMemberProps> = ({ member }) => {

    return (
        <div className="flex-col align-center">
            {
                member.imageUrl && <img src={member.imageUrl} alt={`Member image URL for ${member.name} (${member.id})`} style={{ maxWidth: '5rem' }}/>
            }
            <span>
                {member.name}
            </span>
            {
                member.metadata && (
                    <>
                        {
                            Object.entries(member.metadata).map(([key, value]) => (
                                <div key={key} className="flex flex-between">
                                    <span>{key}:</span>
                                    <span>
                                        {key === 'stationLogoUrl' ? <img src={value} alt="station logo url" style={{ maxWidth: '3rem' }}/> : String(value)}
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