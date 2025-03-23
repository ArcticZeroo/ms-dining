import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { Path } from 'history';

export const useLocationHash = () => {
    const location = useLocation();
    return location.hash;
};

export const usePartialNavigate = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return useCallback(
        (options: Partial<Path>) => {
            navigate({
                ...location,
                ...options
            });
        },
        [location, navigate]
    );
};