import React, { useMemo } from 'react';
import { CollapsibleBody } from '../collapsible/collapsible-body.tsx';
import { CollapsibleContainer } from '../collapsible/collapsible-container.tsx';
import { CollapsibleHeader } from '../collapsible/collapsible-header.tsx';
import { ReviewsSummaryLine } from './reviews-summary-line.tsx';
import { ReviewsView } from './reviews-view.tsx';
import { useReviewSummary } from '../../store/queries/reviews.ts';

import './reviews.css';

interface IMenuItemReviewsViewProps {
    menuItemId: string;
    menuItemName: string;
    cafeId: string;
    stationId?: string;
    stationName?: string;
}

export const MenuItemReviewsView: React.FC<IMenuItemReviewsViewProps> = ({ menuItemId, menuItemName, cafeId, stationId, stationName }) => {
    const lookup = useMemo(() => ({ menuItemId, menuItemName }), [menuItemId, menuItemName]);
    const stationLookup = useMemo(
        () => stationId ? { stationId, stationName: stationName ?? '' } : undefined,
        [stationId, stationName]
    );

    const { status, data, refetch } = useReviewSummary(lookup, stationId);

    return (
        <div className="default-container bg-raised-3 flex-col">
            <CollapsibleContainer>
                <CollapsibleHeader>
                    <div className="flex align-center constant-gap">
                        <span className="bold">
                            Reviews
                        </span>
                        <ReviewsSummaryLine status={status} response={data}/>
                    </div>
                </CollapsibleHeader>
                <CollapsibleBody>
                    <ReviewsView
                        status={status}
                        response={data}
                        onRetry={() => refetch()}
                        cafeId={cafeId}
                        lookup={lookup}
                        stationLookup={stationLookup}
                    />
                </CollapsibleBody>
            </CollapsibleContainer>
        </div>
    )
}