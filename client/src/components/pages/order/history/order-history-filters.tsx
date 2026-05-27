import type { OrderHistorySince } from '../../../../api/ordering.ts';
import { classNames } from '../../../../util/react.ts';

interface IOrderHistoryFiltersProps {
    selectedSince: OrderHistorySince;
    onSinceChanged: (since: OrderHistorySince) => void;
    isHomepageOnly: boolean;
    onHomepageOnlyChanged: (isHomepageOnly: boolean) => void;
    hasHomepageCafes: boolean;
}

const ORDER_HISTORY_RANGE_OPTIONS: Array<{ label: string; since: OrderHistorySince }> = [
    { label: '7 Days', since: '7d' },
    { label: '30 Days', since: '30d' },
    { label: 'All Time', since: 'all' },
];

export const OrderHistoryFilters = ({
    selectedSince,
    onSinceChanged,
    isHomepageOnly,
    onHomepageOnlyChanged,
    hasHomepageCafes,
}: IOrderHistoryFiltersProps) => {
    return (
        <div className="order-history-filters flex flex-wrap">
            <div className="order-history-filter-group flex flex-wrap">
                {ORDER_HISTORY_RANGE_OPTIONS.map((rangeOption) => (
                    <button
                        key={rangeOption.since}
                        type="button"
                        className={classNames(
                            'order-history-chip default-container default-button',
                            selectedSince === rangeOption.since && 'active'
                        )}
                        onClick={() => onSinceChanged(rangeOption.since)}
                    >
                        {rangeOption.label}
                    </button>
                ))}
            </div>
            <button
                type="button"
                className={classNames(
                    'order-history-chip default-container default-button',
                    isHomepageOnly && 'active'
                )}
                onClick={() => onHomepageOnlyChanged(!isHomepageOnly)}
                disabled={!hasHomepageCafes}
                title={hasHomepageCafes ? 'Filter to your homepage cafes' : 'Add homepage cafes to use this filter'}
            >
                Homepage Cafes
            </button>
        </div>
    );
};
