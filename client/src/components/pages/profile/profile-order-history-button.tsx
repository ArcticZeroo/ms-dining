import { Link } from 'react-router-dom';
import { useOrderCountQuery } from '../../../store/queries/ordering.js';
import { pluralize } from '../../../util/string.js';

export const ProfileOrderHistoryButton = () => {
    const orderCountQuery = useOrderCountQuery();

    return (
        <Link to="/order/history?range=30d" className="default-button default-container flex flex-center">
            <span className="material-symbols-outlined">
                history
            </span>
            <span>
                Order History
            </span>
            {
                orderCountQuery.data != null && (
                    <span>
                        ({orderCountQuery.data.count} {pluralize('order', orderCountQuery.data.count)})
                    </span>
                )
            }
        </Link>
    );
}