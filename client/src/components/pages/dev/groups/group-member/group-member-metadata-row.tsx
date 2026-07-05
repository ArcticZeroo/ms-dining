import React from 'react';

interface IGroupMemberMetadataRowProps {
    metadataKey: string;
    value: string;
}

export const GroupMemberMetadataRow: React.FC<IGroupMemberMetadataRowProps> = ({ metadataKey, value }) => (
    <div className="flex flex-between">
        <span>{metadataKey}:</span>
        <span>
            {
                metadataKey === 'stationLogoUrl'
                    ? <img src={value} loading="lazy" alt="<station logo img>" style={{ maxWidth: '3rem' }}/>
                    : String(value)
            }
        </span>
    </div>
);
