import React, { useMemo, useState } from 'react';
import { IPriceHistoryResponse } from '@msdining/common/models/price-history';
import { getPricePairKey } from '@msdining/common/util/price-history';
import { PriceItemSearch } from './price-item-search.tsx';
import { PriceStatsSection } from './price-stats-section.tsx';
import { PriceYearSelect } from './price-year-select.tsx';

const getDefaultYears = (availableYears: number[]): [number | null, number | null] => {
    if (availableYears.length < 2) {
        return [null, null];
    }

    return [availableYears[availableYears.length - 2]!, availableYears[availableYears.length - 1]!];
};

interface IPriceHistoryViewProps {
    data: IPriceHistoryResponse;
}

export const PriceHistoryView: React.FC<IPriceHistoryViewProps> = ({ data }) => {
    const [defaultFrom, defaultTo] = useMemo(() => getDefaultYears(data.availableYears), [data.availableYears]);
    const [fromYear, setFromYear] = useState<number | null>(defaultFrom);
    const [toYear, setToYear] = useState<number | null>(defaultTo);

    if (data.availableYears.length < 2) {
        return (
            <div className="card">
                {
                    data.generatedAt == null
                        ? 'Price history hasn\'t been generated yet. Check back soon.'
                        : 'Not enough fiscal years with data to compare yet.'
                }
            </div>
        );
    }

    const hasValidPair = fromYear != null && toYear != null && fromYear < toYear;
    const stats = hasValidPair
        ? data.statsByPair[getPricePairKey(fromYear, toYear)]
        : undefined;

    return (
        <div className="flex-col">
            <div className="flex flex-wrap price-year-selectors">
                <PriceYearSelect
                    label="Prices effective July 1,"
                    value={fromYear}
                    options={data.availableYears.filter(year => toYear == null || year < toYear)}
                    onChange={setFromYear}
                />
                <PriceYearSelect
                    label="compared to July 1,"
                    value={toYear}
                    options={data.availableYears.filter(year => fromYear == null || year > fromYear)}
                    onChange={setToYear}
                />
            </div>
            {
                stats != null
                    ? <PriceStatsSection stats={stats}/>
                    : <div className="card">Select two different years to compare.</div>
            }
            {
                hasValidPair && (
                    <PriceItemSearch items={data.items} fromYear={fromYear} toYear={toYear}/>
                )
            }
            {
                data.generatedAt != null && (
                    <span className="price-generated-at">
                        Last updated {new Date(data.generatedAt).toLocaleDateString()}
                    </span>
                )
            }
        </div>
    );
};
