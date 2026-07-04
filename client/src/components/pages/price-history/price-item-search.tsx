import React, { useContext, useMemo, useState } from 'react';
import { IPriceChangeItem, IPriceHistoryItem } from '@msdining/common/models/price-history';
import { getItemChangeForPair } from '@msdining/common/util/price-history';
import { fuzzySearch } from '@msdining/common/util/search-util';
import { useDebouncedValue } from '../../../hooks/debounce.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { tryGetViewName } from '../../../util/cafe.ts';
import { PriceChangeTable } from './price-change-table.tsx';

const MAX_RESULTS = 30;
const DEBOUNCE_MS = 200;

interface IPriceItemSearchProps {
    items: IPriceHistoryItem[];
    fromYear: number;
    toYear: number;
}

export const PriceItemSearch: React.FC<IPriceItemSearchProps> = ({ items, fromYear, toYear }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);

    const results = useMemo<IPriceChangeItem[]>(() => {
        if (debouncedQuery.length === 0) {
            return [];
        }

        const matches: IPriceChangeItem[] = [];
        for (const item of items) {
            const cafeName = tryGetViewName({ cafeId: item.cafeId, viewsById, showGroupName: true });
            if (!fuzzySearch(item.name, debouncedQuery) && !fuzzySearch(cafeName, debouncedQuery)) {
                continue;
            }

            const change = getItemChangeForPair(item, fromYear, toYear);
            if (change == null) {
                continue;
            }

            matches.push({
                menuItemId: item.menuItemId,
                name:       item.name,
                cafeId:     item.cafeId,
                ...change,
            });
        }

        matches.sort((a, b) => b.increaseDollars - a.increaseDollars);
        return matches.slice(0, MAX_RESULTS);
    }, [debouncedQuery, items, fromYear, toYear, viewsById]);

    return (
        <div className="card flex-col price-item-search">
            <span className="price-change-list-title">
                Search for an item
            </span>
            <input
                type="search"
                className="price-search-input"
                placeholder="Search by item or cafe name..."
                value={query}
                onChange={event => setQuery(event.target.value)}
            />
            {
                debouncedQuery.length > 0 && (
                    <PriceChangeTable
                        items={results}
                        emptyMessage={`No matching items with a price change from ${fromYear} to ${toYear}.`}
                    />
                )
            }
        </div>
    );
};
