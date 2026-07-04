import React, { Suspense } from 'react';
import { IPriceIncreaseStats } from '@msdining/common/models/price-history';
import { formatPrice } from '../../../util/cart.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { PriceChangeList } from './price-change-list.tsx';
import { PriceStatCard } from './price-stat-card.tsx';
import { PricePerCafeSummary } from './price-per-cafe-summary.tsx';
import { formatPercent } from './price-history-format.ts';

const PriceIncreaseChart = React.lazy(() => import('./price-increase-chart.tsx'));

interface IPriceStatsSectionProps {
    stats: IPriceIncreaseStats;
}

export const PriceStatsSection: React.FC<IPriceStatsSectionProps> = ({ stats }) => {
    if (stats.totalItems === 0) {
        return (
            <div className="card">
                No items were on the menu in both {stats.fromYear} and {stats.toYear}.
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-wrap price-stat-row">
                <PriceStatCard label="Items compared" value={String(stats.totalItems)}/>
                <PriceStatCard label="Increased" value={`${stats.increasedCount} (${formatPercent(stats.increasedFraction)})`}/>
                <PriceStatCard label="Decreased" value={`${stats.decreasedCount} (${formatPercent(stats.decreasedCount / stats.totalItems)})`}/>
                <PriceStatCard label="Avg increase" value={formatPrice(stats.averageIncreaseDollars)}/>
                <PriceStatCard label="Avg increase %" value={formatPercent(stats.averageIncreasePercent)}/>
            </div>
            <div className="price-chart-container flex flex-center">
                <Suspense fallback={<HourglassLoadingSpinner/>}>
                    <PriceIncreaseChart distribution={stats.distribution}/>
                </Suspense>
            </div>
            {
                stats.perCafe.length > 0 && <PricePerCafeSummary perCafe={stats.perCafe}/>
            }
            <div className="flex flex-wrap price-lists">
                <PriceChangeList title="Biggest increases ($)" items={stats.biggestByDollars}/>
                <PriceChangeList title="Biggest increases (%)" items={stats.biggestByPercent}/>
                <PriceChangeList title="Smallest increases ($)" items={stats.smallestByDollars}/>
            </div>
            {
                stats.biggestDecreasesByDollars.length > 0 && (
                    <div className="flex flex-wrap price-lists">
                        <PriceChangeList title="Biggest decreases ($)" items={stats.biggestDecreasesByDollars}/>
                        <PriceChangeList title="Biggest decreases (%)" items={stats.biggestDecreasesByPercent}/>
                    </div>
                )
            }
        </>
    );
};
