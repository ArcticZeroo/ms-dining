import type { ICafeOrder } from '@msdining/common/models/order';
import { classNames } from '../../../../util/react.ts';
import { getErrorMessage } from '../../../../util/mutation.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CompletedOrdersList } from '../status/completed-orders-list.tsx';

interface IOrderHistoryBodyProps {
    orders: ICafeOrder[];
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    onRetry: () => void;
}

export const OrderHistoryBody = ({ orders, isLoading, isFetching, isError, error, onRetry }: IOrderHistoryBodyProps) => {
    if (isError) {
        return (
            <>
                <div className="card error">
                    {getErrorMessage(error, 'Failed to load order history')}
                </div>
                <div className="flex flex-justify-center">
                    <RetryButton onClick={onRetry}/>
                </div>
            </>
        );
    }

    if (isLoading) {
        return (
            <div className="card flex flex-justify-center">
                <HourglassLoadingSpinner/>
                <span>Loading order history...</span>
            </div>
        );
    }

    return (
        <div className={classNames('flex-col', isFetching && 'loading-skeleton')}>
            <CompletedOrdersList orders={orders} showCompoundReorderButtons={false} showDate={true}/>
        </div>
    );
};
