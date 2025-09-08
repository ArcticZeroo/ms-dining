import React from 'react';
import { Link } from 'react-router-dom';
import { HttpException } from '../../exception/http.ts';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { RetryButton } from '../button/retry-button.tsx';

interface IAuthenticatedFailureCardProps {
    message: string;
    error?: Error;
    onRetry: () => void;
}

export const AuthenticatedFailureCard: React.FC<IAuthenticatedFailureCardProps> = ({ message, error, onRetry }) => {
    const isLoggedIn = useIsLoggedIn();

    if (error instanceof HttpException && error.statusCode === 401) {
        return (
            <div className="card">
                <span>
                    {
                        isLoggedIn
                            ? 'Your session has expired since you loaded this page.'
                            : 'You must be logged in to view this content.'
                    }
                    <Link to="login" className="default-button default-container">
                        Login
                    </Link>
                </span>
            </div>
        );
    }

    return (
        <div className="card">
            <span>
                {message}
                <RetryButton onClick={onRetry} />
            </span>
        </div>
    );
};