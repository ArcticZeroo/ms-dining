import { useNavigate } from 'react-router-dom';
import { useValueNotifier, useValueNotifierContext } from './events.ts';
import { DebugSettings } from '../constants/settings.ts';
import { useEffect } from 'react';
import { UserIdContext } from '../context/auth.ts';

export const useIsLoggedIn = () => {
    const userId = useValueNotifierContext(UserIdContext);
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);
    return isAuthEnabled && userId != null;
}

export const useRequireAuthEnabled = () => {
    const navigate = useNavigate();
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);
    
    useEffect(() => {
        if (!isAuthEnabled) {
            navigate('/');
        }
    }, [isAuthEnabled, navigate]);
}

export const useRequireLoginStatus = (shouldBeLoggedIn: boolean, navigateToPageOtherwise = '/') => {
    const navigate = useNavigate();
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);
    const isLoggedIn = useIsLoggedIn();

    const isAllowed = isAuthEnabled && isLoggedIn === shouldBeLoggedIn;

    useEffect(() => {
        if (!isAuthEnabled) {
            navigate(navigateToPageOtherwise);
            return;
        }

        if (isLoggedIn !== shouldBeLoggedIn) {
            if (shouldBeLoggedIn) {
                navigate('/login');
            } else {
                navigate(navigateToPageOtherwise);
            }
        }
    }, [isAuthEnabled, isLoggedIn, navigate, shouldBeLoggedIn, navigateToPageOtherwise]);

    return isAllowed;
}