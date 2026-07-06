import React from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

interface ISearchResultImageSectionProps {
    imageUrl?: string;
    isSkeleton: boolean;
    name: string;
}

export const SearchResultImageSection: React.FC<ISearchResultImageSectionProps> = ({
    imageUrl,
    isSkeleton,
    name,
}) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);

    if (!showImages) {
        return null;
    }

    if (imageUrl) {
        return <img src={imageUrl} alt={name} className="search-result-image" decoding="async" loading="lazy"/>;
    }

    if (isSkeleton) {
        return <div className="search-result-image"/>;
    }

    return null;
};
