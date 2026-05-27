import type { OrderHistorySince } from '../../../../api/ordering.ts';
import { classNames } from '../../../../util/react.ts';
import { HomepageCafesFilterButton } from '../../../button/homepage-cafes-filter-button.tsx';

interface IOrderHistoryFiltersProps {
    selectedSince: OrderHistorySince;
    onSinceChanged: (since: OrderHistorySince) => void;
    isHomepageOnly: boolean;
    onHomepageOnlyChanged: (isHomepageOnly: boolean) => void;
    hasHomepageViews: boolean;
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
    hasHomepageViews,
}: IOrderHistoryFiltersProps) => {
    return (
        <div className="order-history-filters flex flex-wrap">
            <div className="tab-selector flex flex-wrap">
                {ORDER_HISTORY_RANGE_OPTIONS.map((rangeOption) => (
                    <button
                        key={rangeOption.since}
                        type="button"
                        className={classNames(
                            'tab-option',
                            selectedSince === rangeOption.since && 'active'
                        )}
                        onClick={() => onSinceChanged(rangeOption.since)}
                    >
                        {rangeOption.label}
                    </button>
                ))}
            </div>
            {hasHomepageViews && (
                <HomepageCafesFilterButton
                    isActive={isHomepageOnly}
                    onClick={() => onHomepageOnlyChanged(!isHomepageOnly)}
                />
            )}
        </div>
    );
};
