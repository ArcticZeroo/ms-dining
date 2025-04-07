import { Link, useLocation, useRouteError } from 'react-router-dom';
import { useEffect } from 'react';
import { ReloadButton } from '../../button/reload-button.tsx';

export const ErrorPage = () => {
    const location = useLocation();
    const error = useRouteError();

    const isHome = location.pathname === '/';

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="error-card">
            <div>
                {String(error)}
            </div>
            {
                !isHome && (
                    <Link to="/" className="link-button">
                        Navigate Home
                    </Link>
                )
            }
            <ReloadButton/>
        </div>
    );
};