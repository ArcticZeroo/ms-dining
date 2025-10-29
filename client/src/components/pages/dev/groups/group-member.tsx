import { IGroupMember } from '@msdining/common/models/group';
import React from 'react';
import { entityDisplayDataByType } from '../../../../constants/search.js';
import { classNames } from '../../../../util/react.js';

interface IGroupMemberProps {
    member: IGroupMember;
}

export const GroupMember: React.FC<IGroupMemberProps> = ({ member }) => {
    const displayData = entityDisplayDataByType[member.type];

    return (
        <>
            <span className={classNames(displayData.className, 'default-container flex flex-center')}>
                <span className='material-symbols-outlined'>
                    {displayData.iconName}
                </span>
            </span>
            {
                member.imageUrl && <img src={member.imageUrl} alt={`Member image URL for ${member.name} (${member.id})`} style={{ maxWidth: '5rem' }}/>
            }
            <span>
                {member.name} ({member.id})
            </span>
            {
                member.metadata && (
                    <>
                        {
                            Object.entries(member.metadata).map(([key, value]) => (
                                <div key={key} className="flex flex-between">
                                    <span>{key}</span>
                                    <span>
                                        {key === 'stationLogoUrl' ? <img src={value} alt="station logo url" style={{ maxWidth: '3rem' }}/> : String(value)}
                                    </span>
                                </div>
                            ))
                        }
                    </>
                )
            }
        </>
    );
}