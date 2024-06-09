import React, { useContext } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { CafeView } from '../../../models/cafe.ts';
import { MenuPageWithViews } from './menu-page-with-views.tsx';

export const CafeViewPage: React.FC = () => {
    const { viewsById } = useContext(ApplicationContext);
    const { id: oneOrManyIds } = useParams();

    if (!oneOrManyIds) {
        return (
            <div className="error-card">
                No cafe id provided!
            </div>
        );
    }

    const ids = oneOrManyIds.split('+');
    const views: CafeView[] = [];
    for (const id of new Set(ids)) {
        const view = viewsById.get(id);
        if (view != null) {
            views.push(view);
        }
    }

    if (ids.length !== views.length) {
        return <Navigate
            to={`/menu/${views.map(view => view.value.id).join('+')}`}
            replace={true}
        />;
    }

    if (views.length === 0) {
        return (
            <div className="error-card">
                None of the following views were found: {ids.join(', ')}
            </div>
        );
    }

    return (
        <MenuPageWithViews views={views}/>
    );
};