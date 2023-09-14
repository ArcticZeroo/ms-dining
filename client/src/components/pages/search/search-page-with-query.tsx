import React, { useContext, useEffect, useRef, useState } from 'react';
import { DiningHallMenu, IDiningHall } from '../../../models/dining-halls.ts';
import { fuzzySearch } from '../../../util/search.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { DiningHallClient } from '../../../api/dining.ts';
import { SearchResultsByItemName } from '../../../models/search.ts';
import { SearchResults } from '../../search/search-results.tsx';

interface ISearchPageWithQueryProps {
    queryText: string;
}

const getMatchingItems = (queryText: string, concepts: DiningHallMenu) => {
    const items = [];
    const seenItemNames = new Set<string>();
    for (const concept of concepts) {
        for (const category of Object.keys(concept.menu)) {
            for (const item of concept.menu[category]) {
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
            diningHallIds: [...searchResult.diningHallIds],
            stableId:      searchResult.stableId,
            imageUrl:      searchResult.imageUrl
        });
    }
    return newSearchResults;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const { diningHallsById } = useContext(ApplicationContext);
    const nextStableIdRef = useRef(0);
    const searchSymbolRef = useRef(Symbol());
    const [searchResultsByItemName, setSearchResultsByItemName] = useState<SearchResultsByItemName>(new Map());
    const [failedDiningHallIds, setFailedDiningHallIds] = useState<string[]>([]);
    const [waitingDiningHallIds, setWaitingDiningHallIds] = useState<Set<string>>(() => new Set());

    const addMenuToSearchResults = (diningHall: IDiningHall, concepts: DiningHallMenu) => {
        const matchingItems = getMatchingItems(queryText, concepts);
        setSearchResultsByItemName((previousSearchResults) => {
            const newSearchResults = cloneSearchResultsByItemName(previousSearchResults);
            for (const item of matchingItems) {
                if (!newSearchResults.has(item.displayName)) {
                    newSearchResults.set(item.displayName, {
                        diningHallIds: [],
                        stableId:      nextStableIdRef.current++,
                        imageUrl:      item.imageUrl
                    });
                }
                newSearchResults.get(item.displayName)!.diningHallIds.push(diningHall.id);
            }
            return newSearchResults;
        });
    };

    const searchAndAddToResults = (diningHall: IDiningHall) => {
        // If we change the dining hall list or search query while we're searching, we don't want to add the results.
        const currentSymbol = searchSymbolRef.current;
        DiningHallClient.retrieveDiningHallMenu(diningHall.id, false /*shouldCountTowardsLastUsed*/)
            .then(menu => {
                if (currentSymbol === searchSymbolRef.current) {
                    addMenuToSearchResults(diningHall, menu);
                }
            })
            .catch(err => {
                if (currentSymbol === searchSymbolRef.current) {
                    console.log('Failed to retrieve menu:', err);
                    setFailedDiningHallIds(previousFailedDiningHallIds => [...previousFailedDiningHallIds, diningHall.id]);
                }
            })
            .finally(() => {
                setWaitingDiningHallIds((previousWaitingDiningHallIds) => {
                    const newWaitingDiningHallIds = new Set(previousWaitingDiningHallIds);
                    newWaitingDiningHallIds.delete(diningHall.id);
                    return newWaitingDiningHallIds;
                });
            });
    }

    useEffect(() => {
        searchSymbolRef.current = Symbol();
        setSearchResultsByItemName(new Map());
        setWaitingDiningHallIds(new Set(diningHallsById.keys()));
        for (const diningHall of diningHallsById.values()) {
            searchAndAddToResults(diningHall);
        }
    }, [diningHallsById, queryText]);

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="page-title">Search Results for "{queryText}"</div>
                    <div className="search-result-count">
                        Search Results: {searchResultsByItemName.size}
                    </div>
                </div>
                <div className={`search-waiting${waitingDiningHallIds.size > 0 ? ' visible' : ''}`}>
                    <div className="loading-spinner"/>
                    <div>
                        Waiting for {waitingDiningHallIds.size} menu(s)
                    </div>
                </div>
            </div>
            {
                failedDiningHallIds.length > 0 && (
                    <div>
                        Unable to retrieve menus for dining halls: {failedDiningHallIds.join(', ')}
                    </div>
                )
            }
            <SearchResults searchResultsByItemName={searchResultsByItemName}/>
        </div>
    );
}