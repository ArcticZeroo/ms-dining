import { usePageData } from '../../../hooks/location.ts';
import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';
import { PROVIDER_GOOGLE, PROVIDER_MICROSOFT } from '@msdining/common/dist/models/auth';
import { useRequireLoginStatus } from '../../../hooks/auth.ts';

import './login-page.css';

export const LoginPage = () => {
    const isPageAllowed = useRequireLoginStatus(false, '/profile');
    usePageData('Log In', 'Log into an account for more features.');
    
    if (!isPageAllowed) {
        return null;
    }

    return (
        <div className="flex-col flex-center">
            <div className="card">
                <div className="title">
                    Log In
                </div>
                <div className="subtitle">
                    Personal accounts are ok! No need for intune 🙂
                </div>
                <a href="/api/auth/microsoft/login"
                    className="login-provider default-container default-button flex flex-between">
                    Sign in with Microsoft
                    <AuthProviderBadge provider={PROVIDER_MICROSOFT}/>
                </a>
                <a href="/api/auth/google/login"
                    className="login-provider default-container default-button flex flex-between">
                    Sign in with Google
                    <AuthProviderBadge provider={PROVIDER_GOOGLE}/>
                </a>
            </div>
            <div className="card blue">
                <div className="title">
                    Why log in?
                </div>
                <div>
                    <ul>
                        <li>
                            Sync settings like your favorites and homepage views across devices
                        </li>
                        <li>
                            Save reviews for menu items
                        </li>
                        <li>
                            ...eventually in the future, reviews will be used for recommendations 🙂
                        </li>
                    </ul>
                </div>
                <div>
                    You don't have to log in for the majority of functionality. You can still view menus, search, etc. regardless.
                </div>
            </div>
        </div>
    );
};