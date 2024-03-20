import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { setPageData } from '../../../util/title.ts';
import { ApplicationContext } from '../../../context/app.ts';

export const NotFoundPage = () => {
    const { viewsById } = useContext(ApplicationContext);
    const location = useLocation();
    const navigate = useNavigate();

    const view = viewsById.get(location.pathname.slice(1));

    useEffect(() => {
        if (view != null) {
            return navigate(`/menu/${view.value.id}`);
        }

        setPageData('Page Not Found', 'The page you are looking for does not exist');
    }, [navigate, view]);

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