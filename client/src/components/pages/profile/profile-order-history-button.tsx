import { Link } from 'react-router-dom';
import { useOrderHistorySummaryQuery } from '../../../store/queries/ordering.js';
import { pluralize } from '../../../util/string.js';

export const ProfileOrderHistoryButton = () => {
    const summaryQuery = useOrderHistorySummaryQuery();

    return (
        <Link to="/order/history?range=30d" className="default-button default-container flex flex-center">
            <span className="material-symbols-outlined">
                history
            </span>
            <span>
                Order History
            </span>
            {
                summaryQuery.data != null && (
                    <span>
                        ({summaryQuery.data.count} {pluralize('order', summaryQuery.data.count)})
                    </span>
                )
            }
        </Link>
    );
}