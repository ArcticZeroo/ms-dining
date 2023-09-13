import { IDiningHallConcept } from '../../../../models/dining-halls.ts';
import React from 'react';
import { Menu } from './menu.tsx';

export interface IDiningHallConceptProps {
    concept: IDiningHallConcept;
}

export const Concept: React.FC<IDiningHallConceptProps> = ({ concept }) => {
    console.log(concept);

    return (
        <div className="concept">
            <div className="title">
                {
                    concept.logoUrl && (
                        <img src={concept.logoUrl} alt={`Logo for concept ${concept.name}`}/>
                    )
                }
                {concept.name}
            </div>
            <Menu menuItemsByCategoryName={concept.menu}/>
        </div>
    );
};