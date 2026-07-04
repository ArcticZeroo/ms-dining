import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { usePageData } from '../../../hooks/location.ts';
import { usePriceHistoryQuery } from '../../../store/queries/price-history.ts';
import { PriceHistoryView } from './price-history-view.tsx';
import './price-history-page.css';

export const PriceHistoryPage = () => {
    usePageData('Price History', 'See how Microsoft dining prices have changed year over year');

    const { data, isPending, isError, refetch } = usePriceHistoryQuery();

    return (
        <div className="card" id="price-history-page">
            <div className="title">
                Price History
            </div>
            {
                isPending && (
                    <div className="flex flex-center">
                        <HourglassLoadingSpinner/>
                        <span>
                            Loading price history...
                        </span>
                    </div>
                )
            }
            {
                isError && (
                    <div className="flex flex-col flex-center">
                        <span>
                            Could not load price history!
                        </span>
                        <RetryButton onClick={() => refetch()}/>
                    </div>
                )
            }
            {
                data != null && <PriceHistoryView data={data}/>
            }
        </div>
    );
};
