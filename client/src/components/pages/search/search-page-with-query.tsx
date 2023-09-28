import React, { useContext, useEffect, useRef, useState } from 'react';
import { CafeMenu, ICafe } from '../../../models/cafe.ts';
import { fuzzySearch } from '../../../util/search.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { DiningClient } from '../../../api/dining.ts';
import { SearchResultsByItemName } from '../../../models/search.ts';
import { SearchResults } from '../../search/search-results.tsx';

interface ISearchPageWithQueryProps {
    queryText: string;
}

const getMatchingItems = (queryText: string, stations: CafeMenu) => {
    const items = [];
    const seenItemNames = new Set<string>();
    for (const station of stations) {
        for (const category of Object.keys(station.menu)) {
            for (const item of station.menu[category]) {
                if (seenItemNames.has(item.displayName)) {
                    continue;
                }

                if (fuzzySearch(item.displayName, queryText)) {
                    items.push(item);
                    seenItemNames.add(item.displayName);
                }
            }
        }
    }
    return items;
}

const cloneSearchResultsByItemName = (searchResultsByItemName: SearchResultsByItemName) => {
    const newSearchResults = new Map();
    for (const [itemName, searchResult] of searchResultsByItemName.entries()) {
        newSearchResults.set(itemName, {
            cafeIds:  [...searchResult.cafeIds],
            stableId: searchResult.stableId,
            imageUrl: searchResult.imageUrl
        });
    }
    return newSearchResults;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const { cafes } = useContext(ApplicationContext);
    const nextStableIdRef = useRef(0);
    const searchSymbolRef = useRef(Symbol());
    const [searchResultsByItemName, setSearchResultsByItemName] = useState<SearchResultsByItemName>(new Map());
    const [failedCafeIds, setFailedCafeIds] = useState<string[]>([]);
    const [waitingCafeIds, setWaitingCafeIds] = useState<Set<string>>(() => new Set());

    const addMenuToSearchResults = (cafe: ICafe, stations: CafeMenu) => {
        const matchingItems = getMatchingItems(queryText, stations);
        setSearchResultsByItemName((previousSearchResults) => {
            const newSearchResults = cloneSearchResultsByItemName(previousSearchResults);
            for (const item of matchingItems) {
                if (!newSearchResults.has(item.displayName)) {
                    newSearchResults.set(item.displayName, {
                        cafeIds:  [],
                        stableId: nextStableIdRef.current++,
                        imageUrl: item.imageUrl
                    });
                }
                newSearchResults.get(item.displayName)!.cafeIds.push(cafe.id);
            }
            return newSearchResults;
        });
    };

    const searchAndAddToResults = (cafe: ICafe) => {
        // If we change the cafe list or search query while we're searching, we don't want to add the results.
        const currentSymbol = searchSymbolRef.current;
        DiningClient.retrieveCafeMenu(cafe.id, false /*shouldCountTowardsLastUsed*/)
            .then(menu => {
                if (currentSymbol === searchSymbolRef.current) {
                    addMenuToSearchResults(cafe, menu);
                }
            })
            .catch(err => {
                if (currentSymbol === searchSymbolRef.current) {
                    console.log('Failed to retrieve menu:', err);
                    setFailedCafeIds(previousFailedCafeIds => [...previousFailedCafeIds, cafe.id]);
                }
            })
            .finally(() => {
                setWaitingCafeIds((previousWaitingCafeIds) => {
                    const newWaitingCafeIds = new Set(previousWaitingCafeIds);
                    newWaitingCafeIds.delete(cafe.id);
                    return newWaitingCafeIds;
                });
            });
    }

    useEffect(() => {
        searchSymbolRef.current = Symbol();
        setSearchResultsByItemName(new Map());

        setWaitingCafeIds(new Set(cafes.map(diningHall => diningHall.id)));
        for (const cafe of cafes) {
            searchAndAddToResults(cafe);
        }
    }, [cafes, queryText]);

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="page-title">Search Results for "{queryText}"</div>
                    <div className="search-result-count">
                        Search Results: {searchResultsByItemName.size}
                    </div>
                </div>
                <div className={`search-waiting${waitingCafeIds.size > 0 ? ' visible' : ''}`}>
                    <div className="loading-spinner"/>
                    <div>
                        Waiting for {waitingCafeIds.size} menu(s)
                    </div>
                </div>
            </div>
            {
                failedCafeIds.length > 0 && (
                    <div>
                        Unable to retrieve menus for cafes: {failedCafeIds.join(', ')}
                    </div>
                )
            }
            <SearchResults searchResultsByItemName={searchResultsByItemName} queryText={queryText}/>
        </div>
    );
}