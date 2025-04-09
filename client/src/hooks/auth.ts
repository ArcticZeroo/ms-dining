import { useNavigate } from 'react-router-dom';
import { useValueNotifierContext } from './events.ts';
import { useEffect } from 'react';
import { UserIdContext } from '../context/auth.ts';

export const useIsLoggedIn = () => {
    const userId = useValueNotifierContext(UserIdContext);
    return userId != null;
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