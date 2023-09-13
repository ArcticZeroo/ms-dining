import { IDiningHallConcept } from '../../../models/dining-halls.ts';
import React from 'react';
import { Menu } from './menu.tsx';

export interface IDiningHallConceptProps {
    concept: IDiningHallConcept;
}

export const DiningHallConcept: React.FC<IDiningHallConceptProps> = ({ concept }) => {
    console.log(concept);

    return (
        <div className="concept">
            <div className="title">
                {concept.name}
            </div>
            <Menu menuItemsByCategoryName={concept.menu}/>
        </div>
    );
};