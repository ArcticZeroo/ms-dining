import React from 'react';
import { Link } from 'react-router-dom';
import { prefetchSearchResultsForNavigation } from '../../store/queries/search.ts';
import { getSearchUrl } from '../../util/url.ts';

interface ISearchLinkProps {
    query: string;
    className?: string;
    title?: string;
    children: React.ReactNode;
}

/**
 * A Link to a search results page that prefetches the results on pointer-down,
 * so the fetch starts before the (lazy) destination page mounts. Centralizes the
 * getSearchUrl + prefetch pairing for all Link-based search entry points.
 */
export const SearchLink: React.FC<ISearchLinkProps> = ({ query, className, title, children }) => (
    <Link
        to={getSearchUrl(query)}
        className={className}
        title={title}
        onPointerDown={() => prefetchSearchResultsForNavigation(query)}
    >
        {children}
    </Link>
);
