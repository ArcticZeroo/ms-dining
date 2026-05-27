import React from 'react';

export interface ITagData {
	name: string;
	icon: React.ReactNode;
	color: string;
}

const EMISSIONS_TAG_COLOR = '#384c6e';

/**
 * Maps a tag to the set of tags that imply it. If any of the implying
 * tags are selected, this tag should also be highlighted.
 * e.g. "vegan" is implied by "vegetarian" — all vegan food is vegetarian.
 */
const tagImpliedBy: Partial<Record<string, Set<string>>> = {
    'vegan': new Set(['vegetarian']),
};

/**
 * Returns whether a tag should be highlighted, either because it's
 * directly selected or implied by a selected tag.
 */
export const isTagHighlighted = (tagName: string, selectedTags: ReadonlySet<string>): boolean => {
    if (selectedTags.has(tagName)) {
        return true;
    }

    return tagImpliedBy[tagName]?.has(tagName) === true;
};

// The first one hit will be the highlight color.
export const knownTags: Record<string, ITagData> = {
    'gluten free': {
        name: 'Gluten Free',
        icon: '🌾',
        color: '#8c796e'
    },
    'vegan': {
        name: 'Vegan',
        icon: '🥕',
        color: '#496449'
    },
    'vegetarian': {
        name: 'Vegetarian',
        icon: '🥦',
        color: '#7d967d'
    },
    'low emissions': {
        name: 'Low Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
    'medium emissions': {
        name: 'Medium Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
    'high emissions': {
        name: 'High Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
};