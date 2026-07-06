import { IMenuItem } from '@msdining/common/models/cafe';
import { useMemo } from 'react';
import { ApplicationSettings } from '../constants/settings.ts';
import { ITagData, isTagHighlighted, knownTags } from '../constants/tags.tsx';
import { useValueNotifier } from './events.ts';

/**
 * Returns the tag data used to highlight a menu item (background color etc.),
 * i.e. the first of its tags that the user has opted to highlight, or undefined.
 */
export const useMenuItemHighlightTag = (menuItem: IMenuItem): ITagData | undefined => {
    const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);

    return useMemo(
        () => {
            for (const tagName of menuItem.tags) {
                if (isTagHighlighted(tagName, highlightTagNames)) {
                    return knownTags[tagName];
                }
            }
        },
        [highlightTagNames, menuItem.tags]
    );
};
