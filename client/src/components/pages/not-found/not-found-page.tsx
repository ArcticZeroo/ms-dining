import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { setPageData } from '../../../util/title.ts';

export const NotFoundPage = () => {
    useEffect(() => {
        setPageData('Page Not Found', 'The page you are looking for does not exist');
    }, []);

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