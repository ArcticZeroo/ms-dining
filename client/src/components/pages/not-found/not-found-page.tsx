import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { setPageSubtitle } from '../../../util/title.ts';

export const NotFoundPage = () => {
    useEffect(() => {
        setPageSubtitle('Page Not Found');
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