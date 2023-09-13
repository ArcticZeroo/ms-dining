import { useAsyncValue } from 'react-router-dom';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { ErrorCard } from '../../card/error.tsx';
import { DiningHallConcept } from './dining-hall-concept.tsx';
import { IDiningHallConcept } from '../../../models/dining-halls.ts';

export const DiningHallConceptList = () => {
    const concepts = useAsyncValue();

    if (!isDuckTypeArray<IDiningHallConcept>(concepts, {
        name:    'string',
        logoUrl: 'string',
        menu:    'object'
    })) {
        return (
            <ErrorCard>
                Unable to load menu!
            </ErrorCard>
        );
    }

    return (
        <div className="concepts">
            {concepts.map(concept => <DiningHallConcept key={concept.name} concept={concept}/>)}
        </div>
    );
};