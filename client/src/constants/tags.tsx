import React from 'react';

export interface ITagData {
	name: string;
	icon: React.ReactNode;
	color: string;
}

const EMISSIONS_TAG_COLOR = '#384c6e';

/**
 * Tags that should also be highlighted when a given tag is selected.
 * e.g. selecting "vegetarian" also highlights "vegan" items since
 * all vegan food is vegetarian.
 */
export const tagImplications: Partial<Record<string, string[]>> = {
    'vegetarian': ['vegan'],
};

/**
 * Returns whether a tag should be highlighted, either because it's
 * directly selected or implied by a selected tag.
 */
export const isTagHighlighted = (tagName: string, selectedTags: ReadonlySet<string>): boolean => {
    if (selectedTags.has(tagName)) {
        return true;
    }
    for (const selectedTag of selectedTags) {
        if (tagImplications[selectedTag]?.includes(tagName)) {
            return true;
        }
    }
    return false;
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
    'low_circle': {
        name: 'Low Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
    'medium_circle': {
        name: 'Medium Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
    'high_circle': {
        name: 'High Emissions',
        icon: '🌎',
        color: EMISSIONS_TAG_COLOR
    },
};