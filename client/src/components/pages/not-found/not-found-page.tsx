import { useLocation, useNavigate } from 'react-router-dom';
import { useContext, useEffect } from 'react';
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

        return navigate('/');
    }, [navigate, view]);
};