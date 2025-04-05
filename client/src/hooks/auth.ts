import { useNavigate } from 'react-router-dom';
import { useValueNotifier } from './events.ts';
import { DebugSettings } from '../constants/settings.ts';
import { useContext, useEffect } from 'react';
import { ApplicationContext } from '../context/app.ts';

export const useRequireAuthEnabled = () => {
    const navigate = useNavigate();
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);
    
    useEffect(() => {
        if (!isAuthEnabled) {
            navigate('/');
        }
    }, [isAuthEnabled, navigate]);
}

export const useRequireLoginStatus = (shouldBeLoggedIn: boolean) => {
    const navigate = useNavigate();
    const { isLoggedIn } = useContext(ApplicationContext);
    const isAuthEnabled = useValueNotifier(DebugSettings.auth);

    const isAllowed = isAuthEnabled && isLoggedIn === shouldBeLoggedIn;

    useEffect(() => {
        if (!isAuthEnabled) {
            navigate('/');
            return;
        }

        if (isLoggedIn !== shouldBeLoggedIn) {
            if (shouldBeLoggedIn) {
                navigate('/login');
            } else {
                navigate('/');
            }
        }
    }, [isAuthEnabled, isLoggedIn, navigate, shouldBeLoggedIn]);

    return isAllowed;
}