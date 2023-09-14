import { DiningHallMenu } from '../../../models/dining-halls.ts';
import React from 'react';
import { Concept } from './concept.tsx';

interface IConceptListProps {
    concepts: DiningHallMenu;
    isVisible: boolean;
}

export const ConceptList: React.FC<IConceptListProps> = ({ concepts, isVisible }) => {
    return (
        <div className={`concepts${isVisible ? '' : ' hidden'}`}>
            {concepts.map(concept => <Concept key={concept.name} concept={concept}/>)}
        </div>
    );
};