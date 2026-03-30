import { IAutocompleteSuggestion, SearchEntityType } from '@msdining/common/models/search';
import { type IAutocompleteMatch, matchAutocomplete } from '@msdining/common/util/autocomplete';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { CafeView, CafeViewType, ICafeGroup } from '../models/cafe.ts';
import { getViewName } from './cafe.js';
import type { IBuildingOutline } from '@msdining/common/models/building';

const MICROSOFT_BUILDINGS_PROMISE = import('@msdining/common/constants/buildings')
    .then(module => module.MICROSOFT_BUILDINGS)
    .catch(err => {
        console.error('Could not load building data for autocomplete:', err);
        return [];
    });

const MAX_RESULTS = 5;

interface IScoredSuggestion {
    suggestion: IAutocompleteSuggestion;
    match: IAutocompleteMatch;
}

interface INormalizedName {
    original: string;
    normalized: string;
}

export interface INormalizedCafeView {
    cafeId: string;
    displayName: string;
    names: INormalizedName[];
}

const isGroupVisibleWithGroupsAllowed = (group: ICafeGroup) => group.members.length > 0 && !group.alwaysExpand;

const getMatchableNames = (view: CafeView): string[] => {
    const names: string[] = [view.value.name];

    if (view.value.shortName != null) {
        names.push(String(view.value.shortName));
    }

    if (view.value.aliases) {
        for (const alias of view.value.aliases) {
            names.push(alias);
        }
    }

    return names;
};

const isViewVisibleForAutocomplete = (view: CafeView, shouldUseGroups: boolean): boolean => {
    if (!shouldUseGroups) {
        return view.type === CafeViewType.single;
    }

    // Always show groups when shouldUseGroups is on
    if (view.type === CafeViewType.group) {
        return isGroupVisibleWithGroupsAllowed(view.value);
    }

    // Single cafes with no group (or the outer group is not visible) should be visible
    if (!view.value.group || !isGroupVisibleWithGroupsAllowed(view.value.group)) {
        return true;
    }

    // Single inside a visible group: show only if name differs from group
    // (avoids duplicate "Food Hall 4" for both group and member)
    return view.value.name !== view.value.group.name;
};

const getBestMatches = (matches: IScoredSuggestion[]): IAutocompleteSuggestion[] => {
    matches.sort((a, b) => {
        if (a.match.quality !== b.match.quality) {
            return a.match.quality - b.match.quality;
        }
        return a.match.distance - b.match.distance;
    });

    return matches.slice(0, MAX_RESULTS).map(scored => scored.suggestion);
};

export const buildNormalizedCafeViews = (
    viewsById: Map<string, CafeView>,
    shouldUseGroups: boolean,
): INormalizedCafeView[] => {
    const result: INormalizedCafeView[] = [];
    const seenViewIds = new Set<string>();

    for (const view of viewsById.values()) {
        if (!isViewVisibleForAutocomplete(view, shouldUseGroups)) {
            continue;
        }

        if (seenViewIds.has(view.value.id)) {
            continue;
        }

        seenViewIds.add(view.value.id);

        const matchableNames = getMatchableNames(view);
        const names: INormalizedName[] = [];

        for (const name of matchableNames) {
            const normalized = normalizeNameForSearch(name);
            if (normalized.length > 0) {
                names.push({ original: name, normalized });
            }
        }

        if (names.length > 0) {
            result.push({
                cafeId:      view.value.id,
                displayName: getViewName({ view, showGroupName: true }),
                names,
            });
        }
    }

    return result;
};

interface INormalizedBuilding {
    building: IBuildingOutline;
    names: INormalizedName[];
}

const normalizedBuildings: INormalizedBuilding[] = [];
MICROSOFT_BUILDINGS_PROMISE.then(buildings => {
    for (const building of buildings) {
        const names: INormalizedName[] = [];

        const addName = (name: string) => {
            const normalized = normalizeNameForSearch(name);
            if (normalized.length > 0) {
                names.push({ original: name, normalized });
            }
        };

        addName(building.name);
        if (building.number != null) {
            addName(String(building.number));
        }

        if (names.length > 0) {
            normalizedBuildings.push({ building, names });
        }
    }
});


interface IAutocompleteCandidate {
    names: INormalizedName[];
    suggestion: IAutocompleteSuggestion;
}

const getAllAutocompleteCandidates = (normalizedViews: INormalizedCafeView[]): IAutocompleteCandidate[] => {
    const candidates: IAutocompleteCandidate[] = [];

    for (const view of normalizedViews) {
        candidates.push({
            names:      view.names,
            suggestion: {
                entityType: SearchEntityType.cafe,
                name:       view.displayName,
                cafeId:     view.cafeId,
            },
        });
    }

    for (const { building, names } of normalizedBuildings) {
        candidates.push({
            names,
            suggestion: {
                entityType: SearchEntityType.building,
                name:       building.name,
                cafeId:     building.cafeId
            },
        });
    }

    return candidates;
};

export const getLocalSuggestions = (
    query: string,
    normalizedViews: INormalizedCafeView[],
): IAutocompleteSuggestion[] => {
    const normalizedQuery = normalizeNameForSearch(query);
    if (normalizedQuery.length === 0) {
        return [];
    }

    const matches: IScoredSuggestion[] = [];
    const candidates = getAllAutocompleteCandidates(normalizedViews);

    for (const { names, suggestion } of candidates) {
        let bestMatch: IAutocompleteMatch | null = null;

        for (const { original, normalized } of names) {
            const match = matchAutocomplete(normalized, normalizedQuery, original);
            if (match != null && (bestMatch == null || match.quality < bestMatch.quality || (match.quality === bestMatch.quality && match.distance < bestMatch.distance))) {
                bestMatch = match;
            }
        }

        if (bestMatch != null) {
            matches.push({
                suggestion: suggestion,
                match:      bestMatch,
            });
        }
    }

    return getBestMatches(matches);
};
