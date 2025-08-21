import { useNavigate } from 'react-router-dom';
import { useValueNotifierContext } from './events.ts';
import { useEffect } from 'react';
import { UserContext } from '../context/auth.ts';

export const useIsLoggedIn = () => {
    const user = useValueNotifierContext(UserContext);
    return user != null;
}

export const useRequireLoginStatus = (shouldBeLoggedIn: boolean, navigateToPageOtherwise = '/') => {
    const navigate = useNavigate();
    const isLoggedIn = useIsLoggedIn();

    const isAllowed = isLoggedIn === shouldBeLoggedIn;

    useEffect(() => {
        if (isLoggedIn !== shouldBeLoggedIn) {
            if (shouldBeLoggedIn) {
                navigate('/login');
            } else {
                navigate(navigateToPageOtherwise);
            }
        }
    }, [isLoggedIn, navigate, shouldBeLoggedIn, navigateToPageOtherwise]);

    return isAllowed;
}

export const useHasRole = (requiredRole: string) => {
    const user = useValueNotifierContext(UserContext);
    return user != null && user.role === requiredRole;
}

export const useRequireRole = (requiredRole: string, navigateToPageOtherwise = '/') => {
    const navigate = useNavigate();
    const hasRole = useHasRole(requiredRole);

    useEffect(() => {
        if (!hasRole) {
            navigate(navigateToPageOtherwise);
        }
    }, [hasRole, navigate, navigateToPageOtherwise]);
}