import React from 'react';
import { DiningHallConcept } from './dining-hall-concept.tsx';
import { useLoaderData } from 'react-router-dom';

export const DiningHallMenu: React.FC = () => {
    const concepts = useLoaderData();

    if (!concepts || !Array.isArray(concepts)) {
        return (
            <div>
                An error occurred! Menu data is missing!
            </div>
        );
    }

    return (
        <div className="concepts">
            {
                concepts.map(concept => <DiningHallConcept key={concept.name} concept={concept}/>)
            }
        </div>
    );
};