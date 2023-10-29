import React, { useContext, useEffect, useRef, useState } from 'react';
import { CafeMenu, ICafe } from '../../../models/cafe.ts';
import { fuzzySearch } from '../../../util/search.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { DiningClient } from '../../../api/dining.ts';
import { ISearchMatch, SearchEntityFilterType, SearchEntityType, SearchResultsMap } from '../../../models/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';
import { EntityButton } from './entity-button.tsx';
import './search-page.css';
import { classNames } from '../../../util/react.ts';
import { getAllowedSearchEntityTypes } from '../../../util/sorting.ts';
import { normalizeName } from '../../../util/string.ts';

interface ISearchPageWithQueryProps {
    queryText: string;
}

const isMatch = (itemName: string, queryText: string) => fuzzySearch(itemName, queryText);

const getMatchingEntities = (queryText: string, stations: CafeMenu): ISearchMatch[] => {
    const matches: ISearchMatch[] = [];
    const seenItemNames = new Set<string>();
    const seenStations = new Set<string>();

    for (const station of stations) {
        const stationNameNormalized = normalizeName(station.name);
        if (!seenStations.has(stationNameNormalized) && isMatch(stationNameNormalized, queryText)) {
            matches.push({
                name:       station.name,
                imageUrl:   station.logoUrl,
                entityType: SearchEntityType.station
            });
            seenStations.add(stationNameNormalized);
        }

        for (const category of Object.keys(station.menu)) {
            for (const menuItem of station.menu[category]) {
                const menuItemNameNormalized = normalizeName(menuItem.name);

                if (seenItemNames.has(menuItemNameNormalized)) {
                    continue;
                }

                if (isMatch(menuItemNameNormalized, queryText)) {
                    matches.push({
                        name:       menuItem.name,
                        imageUrl:   menuItem.imageUrl,
                        entityType: SearchEntityType.menuItem
                    });
                    seenItemNames.add(menuItemNameNormalized);
                }
            }
        }
    }
    return matches;
}

const cloneSearchResultsByItemName = (searchResults: SearchResultsMap): SearchResultsMap => {
    const newSearchResults: SearchResultsMap = new Map();
    for (const [entityType, searchResultsByItemName] of searchResults.entries()) {
        if (!newSearchResults.has(entityType)) {
            newSearchResults.set(entityType, new Map());
        }
        const newSearchResultsByItemName = newSearchResults.get(entityType)!;

        for (const [itemName, searchResult] of searchResultsByItemName.entries()) {
            newSearchResultsByItemName.set(itemName, {
                ...searchResult,
                cafeIds: new Set([...searchResult.cafeIds])
            });
        }
    }
    return newSearchResults;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    const { cafes } = useContext(ApplicationContext);
    const nextStableIdRef = useRef(0);
    const searchSymbolRef = useRef(Symbol());
    const [searchResultsMap, setSearchResultsMap] = useState<SearchResultsMap>(new Map());
    const [failedCafeIds, setFailedCafeIds] = useState<string[]>([]);
    const [waitingCafeIds, setWaitingCafeIds] = useState<Set<string>>(() => new Set());
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const [searchResultCount, setSearchResultCount] = useState<number>(0);

    const addMenuToSearchResults = (cafe: ICafe, stations: CafeMenu) => {
        const matchingItems = getMatchingEntities(queryText, stations);

        setSearchResultsMap((previousSearchResults: SearchResultsMap) => {
            const newSearchResults = cloneSearchResultsByItemName(previousSearchResults);

            for (const match of matchingItems) {
                if (!newSearchResults.has(match.entityType)) {
                    newSearchResults.set(match.entityType, new Map());
                }

                const newSearchResultsByItemName = newSearchResults.get(match.entityType)!;

                const matchNameNormalized = normalizeName(match.name);

                if (!newSearchResultsByItemName.has(matchNameNormalized)) {
                    newSearchResultsByItemName.set(matchNameNormalized, {
                        ...match,
                        stableId: nextStableIdRef.current++,
                        cafeIds:  new Set()
                    });
                }

                newSearchResultsByItemName.get(matchNameNormalized)!.cafeIds.add(cafe.id);
            }

            return newSearchResults;
        });
    };

    const searchAndAddToResults = (cafe: ICafe) => {
        // If we change the cafe list or search query while we're searching, we don't want to add the results.
        const currentSymbol = searchSymbolRef.current;
        DiningClient.retrieveCafeMenu({
            id:                         cafe.id,
            shouldCountTowardsLastUsed: false
        })
            .then(menu => {
                if (currentSymbol === searchSymbolRef.current) {
                    addMenuToSearchResults(cafe, menu);
                }
            })
            .catch(err => {
                if (currentSymbol === searchSymbolRef.current) {
                    console.error('Failed to retrieve menu:', err);
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
        setSearchResultsMap(new Map());

        setWaitingCafeIds(new Set(cafes.map(diningHall => diningHall.id)));
        for (const cafe of cafes) {
            searchAndAddToResults(cafe);
        }
    }, [cafes, queryText]);

    useEffect(() => {
        const allowedEntityTypes = getAllowedSearchEntityTypes(entityFilterType);
        let totalCount = 0;
        for (const allowedEntityType of allowedEntityTypes) {
            totalCount += searchResultsMap.get(allowedEntityType)?.size ?? 0;
        }
        setSearchResultCount(totalCount);
    }, [searchResultsMap, entityFilterType]);

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="page-title">Search Results for "{queryText}"</div>
                    <div className="search-result-count">
                        Search Results: {searchResultCount}
                    </div>
                    <div>
                        Note: search results are limited to today only for now
                    </div>
                </div>
                <div className={classNames('search-waiting', waitingCafeIds.size > 0 && 'visible')}>
                    <div className="loading-spinner"/>
                    <div>
                        Waiting for {waitingCafeIds.size} menu(s)
                    </div>
                </div>
            </div>
            <div className="search-entity-selector">
                <EntityButton name="Menu Items and Stations"
                              isChecked={entityFilterType === SearchEntityFilterType.all}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.all)}/>
                <EntityButton name="Menu Items Only"
                              isChecked={entityFilterType === SearchEntityFilterType.menuItem}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.menuItem)}/>
                <EntityButton name="Stations Only"
                              isChecked={entityFilterType === SearchEntityFilterType.station}
                              onClick={() => setEntityFilterType(SearchEntityFilterType.station)}/>
            </div>
            {
                failedCafeIds.length > 0 && (
                    <div>
                        Unable to retrieve menus for cafes: {failedCafeIds.join(', ')}
                    </div>
                )
            }
            <SearchResultsList searchResults={searchResultsMap} queryText={queryText} entityType={entityFilterType}/>
        </div>
    );
}