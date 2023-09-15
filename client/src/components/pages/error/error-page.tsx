import { Link, useRouteError } from 'react-router-dom';

export const ErrorPage = () => {
    const error = useRouteError();

    return (
        <div className="error-card">
            <div>
                {String(error)}
            </div>
            <Link to="/" className="link-button">
                Navigate Home
            </Link>
        </div>
    );
};