import React from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { SearchLink } from './search-link.tsx';

interface ISearchResultSearchTagsProps {
    searchTags?: Set<string>;
}

export const SearchResultSearchTags: React.FC<ISearchResultSearchTagsProps> = ({ searchTags }) => {
    const showSearchTags = useValueNotifier(ApplicationSettings.showSearchTags);

    if (!showSearchTags) {
        return null;
    }

    return (
        <div className="search-tags">
            {
                (searchTags != null && searchTags.size > 0) && Array.from(searchTags).map(tag => (
                    <SearchLink query={tag} className="search-result-chip" key={tag}
                        title={`Click to search for "${tag}"`}>
                        {tag}
                    </SearchLink>
                ))
            }
        </div>
    );
};
