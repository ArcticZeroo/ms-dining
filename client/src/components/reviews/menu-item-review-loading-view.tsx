import React from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IReviewSummary } from '@msdining/common/models/review';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../button/retry-button.tsx';
import { MenuItemReviewDataView } from './menu-item-review-data-view.tsx';

interface IMenuItemReviewsViewBaseProps {
    stage: PromiseStage;
    response: IReviewSummary | undefined;
    onRetry: () => void;
    cafeId: string;
}

interface IMenuItemReviewsViewForMenuItem extends IMenuItemReviewsViewBaseProps {
    menuItemId: string;
    menuItemName: string;
    stationId?: undefined;
    stationName?: undefined;
}

interface IMenuItemReviewsViewForStation extends IMenuItemReviewsViewBaseProps {
    stationId: string;
    stationName: string;
    menuItemId?: undefined;
    menuItemName?: undefined;
}

type IMenuItemReviewsLoadingViewProps = IMenuItemReviewsViewForMenuItem | IMenuItemReviewsViewForStation;

export const MenuItemReviewsLoadingView: React.FC<IMenuItemReviewsLoadingViewProps> = (props) => {
    const { stage, response, onRetry } = props;

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

    if (props.stationId != null) {
        return (
            <MenuItemReviewDataView
                response={response}
                stationId={props.stationId}
                stationName={props.stationName}
                cafeId={props.cafeId}
            />
        );
    }

    return (
        <MenuItemReviewDataView
            response={response}
            menuItemId={props.menuItemId}
            menuItemName={props.menuItemName}
            cafeId={props.cafeId}
        />
    );
};
