import { PROVIDER_GOOGLE, PROVIDER_MICROSOFT } from '@msdining/common/models/auth';
import { Link } from 'react-router-dom';
import { LoginProviderLink } from './login-provider-link.tsx';

export const LoginCard = () => (
    <div className="card">
        <div className="title">
            Log In
        </div>
        <div className="subtitle">
            Personal accounts are ok! No need for intune 🙂
        </div>
        <LoginProviderLink
            href="/api/auth/microsoft/login"
            label="Sign in with Microsoft"
            provider={PROVIDER_MICROSOFT}
        />
        <LoginProviderLink
            href="/api/auth/google/login"
            label="Sign in with Google"
            provider={PROVIDER_GOOGLE}
        />
        <div className="subtitle">
            Your email is not intentionally stored when you sign in, but your 3rd-party account id will be.
            <br/>
            Details/privacy policy available at <Link to="/info">the info page.</Link>
        </div>
    </div>
);
