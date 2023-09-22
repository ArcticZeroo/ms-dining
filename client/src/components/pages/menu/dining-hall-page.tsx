import React, { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { DiningHallPageWithView } from './dining-hall-page-with-view.tsx';
import { ApplicationContext } from '../../../context/app.ts';

export const DiningHallPage: React.FC = () => {
    const { viewsById } = useContext(ApplicationContext);
    const params = useParams();
    const id = params.id;

    if (!id) {
        return (
            <div className="error-card">
                No dining hall id provided!
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
        <DiningHallPageWithView view={view}/>
    );
};