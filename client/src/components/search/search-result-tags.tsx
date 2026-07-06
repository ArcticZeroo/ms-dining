import { SearchMatchReason } from '@msdining/common/models/search';
import React from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { MenuItemTags } from '../cafes/station/menu-items/menu-item-tags.tsx';

interface ISearchResultTagsProps {
    isCompact: boolean;
    matchReasons: Set<SearchMatchReason>;
    tags?: Set<string>;
}

export const SearchResultTags: React.FC<ISearchResultTagsProps> = ({
    isCompact,
    matchReasons,
    tags,
}) => {
    const showTags = useValueNotifier(ApplicationSettings.showTags);

    if (!tags || (!showTags && !matchReasons.has(SearchMatchReason.tags))) {
        return null;
    }

    return <MenuItemTags tags={tags} showName={!isCompact}/>;
};
