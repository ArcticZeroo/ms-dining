import React from 'react';
import { AuthProviderBadge } from '../../auth/auth-provider-badge.tsx';

interface ILoginProviderLinkProps {
    href: string;
    label: string;
    provider: string;
}

export const LoginProviderLink: React.FC<ILoginProviderLinkProps> = ({ href, label, provider }) => (
    <a href={href}
        className="login-provider default-container default-button flex flex-between">
        {label}
        <AuthProviderBadge provider={provider}/>
    </a>
);
