import { NavigateOptions, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { Path } from 'history';
import { setPageData } from '../util/title.ts';

export const useLocationHash = () => {
    const location = useLocation();
    return location.hash;
};

export const usePartialNavigate = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return useCallback(
        (options: Partial<Path>, navigateOptions?: NavigateOptions) => {
            navigate({
                ...location,
                ...options
            }, navigateOptions);
        },
        [location, navigate]
    );
};

export const usePageData = (subtitle: string, description: string) => {
    useEffect(
        () => {
            setPageData(subtitle, description);
        },
        [subtitle, description]
    );
}