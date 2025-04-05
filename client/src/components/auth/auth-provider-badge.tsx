import React from 'react';
import { PROVIDER_GOOGLE, PROVIDER_MICROSOFT } from '@msdining/common/dist/models/auth';

interface IAuthProviderBadgeProps {
    provider: string;
}

export const AuthProviderBadge: React.FC<IAuthProviderBadgeProps> = ({ provider }) => {
    if (provider === PROVIDER_MICROSOFT) {
        return (
            <img src="/ms.svg" alt="Microsoft Logo" className="auth-provider-icon" />
        );
    }

    if (provider == PROVIDER_GOOGLE) {
        return (
            <img src="/google.svg" alt="Google Logo" className="auth-provider-icon" />
        );
    }

    return null;
};