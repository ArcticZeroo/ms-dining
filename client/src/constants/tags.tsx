import React from 'react';

export interface ITagData {
	name: string;
	icon: React.ReactNode;
	color: string;
}

const EMISSIONS_TAG_COLOR = '#384c6e';

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