import { Link, useRouteError } from 'react-router-dom';
import { useEffect } from 'react';

export const ErrorPage = () => {
    const error = useRouteError();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="error-card">
            <div>
                {String(error)}
            </div>
            <Link to="/" className="link-button">
                Navigate Home
            </Link>
            <button onClick={() => window.location.reload()} className="link-button">
                Reload Page
            </button>
        </div>
    );
};