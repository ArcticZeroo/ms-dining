import { Nullable } from '@msdining/common/models/util';
import React from 'react';

interface IRecommendationReasonProps {
    reason: Nullable<string>;
}

export const RecommendationReason: React.FC<IRecommendationReasonProps> = ({ reason }) => {
    if (!reason) {
        return null;
    }

    return (
        <div className="subtitle">
            {reason}
        </div>
    );
}