import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
    return (
        <div className="error-card">
            <div>
                Page not found!
            </div>
            <Link to="/">
                Navigate Home
            </Link>
        </div>
    );
};