import React from 'react';

export interface ITagData {
	name: string;
	icon: React.ReactNode;
	color: string;
}

// The first one hit will be the highlight color.
export const knownTags: Record<string, ITagData> = {
    'gluten free': {
        name: 'Gluten Free',
        icon: '🌾',
        color: '#ffefd0'
    },
    'vegan': {
        name: 'Vegan',
        icon: '🥕',
        color: '#98de98'
    },
    'vegetarian': {
        name: 'Vegetarian',
        icon: '🥦',
        color: '#cfffcf'
    },
};