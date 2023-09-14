import { DiningHallMenu } from '../../../models/dining-halls.ts';
import React from 'react';
import { Concept } from './concept.tsx';

interface IConceptListProps {
    concepts: DiningHallMenu;
}

export const ConceptList: React.FC<IConceptListProps> = ({ concepts }) => {
    return (
        <div className="concepts">
            {concepts.map(concept => <Concept key={concept.name} concept={concept}/>)}
        </div>
    );
};