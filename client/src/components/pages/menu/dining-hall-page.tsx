import React, { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { DiningHallPageWithId } from './dining-hall-page-with-id.tsx';
import { ApplicationContext } from '../../../context/app.ts';

export const DiningHallPage: React.FC = () => {
    const { diningHallsById } = useContext(ApplicationContext);
    const params = useParams();
    const id = params.id;

    if (!id) {
        return (
            <div className="error-card">
                No dining hall id provided!
            </div>
        );
    }

    const diningHall = diningHallsById.get(id);
    if (!diningHall) {
        return (
            <div className="error-card">
                No dining hall with id {id} found!
            </div>
        );
    }

    return (
        <DiningHallPageWithId diningHall={diningHall}/>
    );
};