import React, { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { CafeViewPageWithView } from './cafe-view-page-with-view.tsx';
import { ApplicationContext } from '../../../context/app.ts';

export const CafeViewPage: React.FC = () => {
    const { viewsById } = useContext(ApplicationContext);
    const params = useParams();
    const { id } = params;

    if (!id) {
        return (
            <div className="error-card">
                No cafe id provided!
            </div>
        );
    }

    const view = viewsById.get(id);
    if (!view) {
        return (
            <div className="error-card">
                No view with id {id} found!
            </div>
        );
    }

    return (
        <CafeViewPageWithView view={view}/>
    );
};