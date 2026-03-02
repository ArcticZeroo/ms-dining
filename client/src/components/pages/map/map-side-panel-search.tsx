import { useCallback, useContext, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { IQuerySearchResult } from '../../../models/search.ts';
import { getViewName } from '../../../util/cafe.ts';
import { useMapHighlightContext, useMapSearchContext } from '../../../context/map.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { MapSearchResults } from './map-search-results.tsx';

const getViewCafeIds = (view: CafeView): Set<string> => {
    const ids = new Set<string>([view.value.id]);
    if (view.type === CafeViewType.group) {
        for (const member of view.value.members) {
            ids.add(member.id);
        }
    }
    return ids;
};

const filterResultsForViews = (results: IQuerySearchResult[], views: CafeView[]): IQuerySearchResult[] => {
    const cafeIds = new Set<string>();
    for (const view of views) {
        for (const id of getViewCafeIds(view)) {
            cafeIds.add(id);
        }
    }
    return results.filter(result =>
        Array.from(result.locationDatesByCafeId.keys()).some(id => cafeIds.has(id))
    );
};

export const MapSidePanelSearch = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { viewsById } = useContext(ApplicationContext);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    const { visibleResults } = useMapSearchContext();
    const { setHighlightedCafeIds, setSelectedSearchResult } = useMapHighlightContext();

    const filterViewIds = useMemo(() => {
        const viewsParam = searchParams.get('views');
        if (!viewsParam) {
            return [];
        }
        return viewsParam.split('+').filter(id => viewsById.has(id));
    }, [searchParams, viewsById]);

    const filterViews = useMemo(
        () => filterViewIds
            .map(id => viewsById.get(id))
            .filter((view): view is CafeView => view != null),
        [filterViewIds, viewsById]
    );

    const hasFilterViews = filterViews.length > 0;

    const filteredResults = useMemo(() => {
        if (!visibleResults || filterViews.length === 0) {
            return undefined;
        }
        return filterResultsForViews(visibleResults, filterViews);
    }, [visibleResults, filterViews]);

    const isFilteredToHomeCafes = hasFilterViews
        && filterViews.every(view => homepageViewIds.has(view.value.id))
        && filterViews.length === homepageViewIds.size;

    const onFilterToHomeCafes = useCallback(() => {
        const homeViewIds = Array.from(homepageViewIds)
            .filter(id => viewsById.has(id));
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('views', homeViewIds.join('+'));
            return next;
        }, { replace: true });
        setSelectedSearchResult(null);
    }, [homepageViewIds, viewsById, setSearchParams, setSelectedSearchResult]);

    const clearFilterViews = useCallback(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('views');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const onClearSearch = () => {
        navigate('/map');
        setHighlightedCafeIds(new Set());
        setSelectedSearchResult(null);
    };

    const viewName = filterViews.length === 1
        ? getViewName({ view: filterViews[0]!, showGroupName: true, includeEmoji: true })
        : filterViews.length > 1
            ? `${filterViews.length} cafes`
            : undefined;

    const results = hasFilterViews ? filteredResults : visibleResults;

    const onCloseButtonClicked = () => {
        if (hasFilterViews) {
            clearFilterViews();
        } else {
            onClearSearch();
        }
    }

    const closeButtonText = hasFilterViews ? 'Back to all results' : 'Clear search';
    const closeButtonIcon = hasFilterViews ? 'arrow_back' : 'close';

    return (
        <div className="map-side-panel flex-col">
            <div className="panel-header flex">
                <span className="material-symbols-outlined">map</span>
                <span className="panel-title">
                    {hasFilterViews ? viewName : 'Campus Map'}
                </span>
                <button
                    onClick={onCloseButtonClicked}
                    className="default-button default-container icon-container"
                    title={closeButtonText}
                >
                    <span className="material-symbols-outlined">{closeButtonIcon}</span>
                </button>
            </div>
            <MapSearchResults
                results={results}
                isFilteredToHomeCafes={isFilteredToHomeCafes}
                onFilterToHomeCafes={onFilterToHomeCafes}
            />
        </div>
    );
};
