import { useAsyncValue } from 'react-router-dom';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { ErrorCard } from '../../card/error.tsx';
import { IDiningHallConcept } from '../../../models/dining-halls.ts';
import { ConceptList } from '../../dining-halls/concept/concept-list.tsx';

export const ConceptListOutlet = () => {
    const concepts = useAsyncValue();

    if (!isDuckTypeArray<IDiningHallConcept>(concepts, {
        name:    'string',
        menu:    'object'
    })) {
        return (
            <ErrorCard>
                Unable to load menu!
            </ErrorCard>
        );
    }

    return (
        <ConceptList concepts={concepts} isVisible={true}/>
    );
};