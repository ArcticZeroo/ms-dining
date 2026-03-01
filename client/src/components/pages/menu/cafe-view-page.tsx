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
    const resolvedIds: string[] = [];
    let needsRedirect = false;

    for (const id of new Set(ids)) {
        const view = viewsById.get(id);
        if (view != null) {
            views.push(view);

            // Cafes can have aliases, so redirect to the actual ID if an alias was used. This also serves to filter out any invalid IDs.
            const resolvedId = view.value.id;
            resolvedIds.push(resolvedId);
            if (resolvedId !== id) {
                needsRedirect = true;
            }
        }
    }

    if (views.length === 0) {
        return (
            <div className="error-card">
                None of the following views were found: {ids.join(', ')}
            </div>
        );
    }

    // Redirect if any ID was an alias or if some IDs were invalid
    if (needsRedirect || ids.length !== views.length) {
        return <Navigate
            to={`/menu/${resolvedIds.join('+')}`}
            replace={true}
        />;
    }

    return (
        <MenuPageWithViews views={views}/>
    );
};