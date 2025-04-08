import React from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IReviewDataForMenuItem } from '@msdining/common/dist/models/review';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../button/retry-button.tsx';
import { MenuItemReviewDataView } from './menu-item-review-data-view.tsx';

interface IMenuItemReviewsViewProps {
    stage: PromiseStage;
    response: IReviewDataForMenuItem | undefined;
    onRetry: () => void;
    menuItemId: string;
}

export const MenuItemReviewsLoadingView: React.FC<IMenuItemReviewsViewProps> = ({
    stage,
    response,
    onRetry,
    menuItemId
}) => {
    if ([PromiseStage.notRun, PromiseStage.running].includes(stage)) {
        return (
            <div className="flex flex-center">
                <span>
                    Loading reviews...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    if (stage === PromiseStage.error || response == null) {
        return (
            <div className="flex flex-center">
                <span>Could not load reviews!</span>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    return (
        <MenuItemReviewDataView response={response} menuItemId={menuItemId}/>
    );
};
