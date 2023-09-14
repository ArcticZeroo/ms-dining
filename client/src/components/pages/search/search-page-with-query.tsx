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
    for (const concept of concepts) {
        for (const category of Object.keys(concept.menu)) {
            for (const item of concept.menu[category]) {
                if (fuzzySearch(item.displayName, queryText)) {
                    items.push(item);
                }
            }
        }
    }
    return items;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const { diningHalls } = useContext(ApplicationContext);
    const nextStableIdRef = useRef(0);
    const searchSymbolRef = useRef(Symbol());
    // item name -> dining hall ids
    const [searchResultsByItemName, setSearchResultsByItemName] = useState<SearchResultsByItemName>(new Map());
    const [failedDiningHallIds, setFailedDiningHallIds] = useState<string[]>([]);

    const addMenuToSearchResults = (diningHall: IDiningHall, concepts: DiningHallMenu) => {
        const matchingItems = getMatchingItems(queryText, concepts);
        setSearchResultsByItemName((previousSearchResults) => {
            const newSearchResults = new Map(previousSearchResults.entries());
            for (const item of matchingItems) {
                if (!newSearchResults.has(item.displayName)) {
                    newSearchResults.set(item.displayName, {
                        diningHalls: [],
                        stableId: nextStableIdRef.current++
                    });
                }
                newSearchResults.get(item.displayName)!.diningHalls.push(diningHall);
            }
            return newSearchResults;
        });
    };

    const searchAndAddToResults = (diningHall: IDiningHall) => {
        // If we change the dining hall list or search query while we're searching, we don't want to add the results.
        const currentSymbol = searchSymbolRef.current;
        DiningHallClient.retrieveDiningHallMenu(diningHall.id)
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
            });
    }

    useEffect(() => {
        searchSymbolRef.current = Symbol();
        setSearchResultsByItemName(new Map());
        for (const diningHall of diningHalls) {
            searchAndAddToResults(diningHall);
        }
    }, [diningHalls, queryText]);

    return (
        <div>
            <h1>Search Results for "{queryText}"</h1>
            {
                failedDiningHallIds.length > 0 && (
                    <div>
                        Unable to retrieve menus for dining halls: {failedDiningHallIds.join(', ')}
                    </div>
                )
            }
            <div>
                Search Results: {searchResultsByItemName.size}
            </div>
            <SearchResults searchResultsByItemName={searchResultsByItemName}/>
        </div>
    );
}