import { IDiningHallConcept } from '../../../models/dining-halls.ts';
import React, { useState } from 'react';
import { ConceptMenu } from './concept-menu.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { classNames } from '../../../util/react.ts';

export interface IDiningHallConceptProps {
    concept: IDiningHallConcept;
}

export const Concept: React.FC<IDiningHallConceptProps> = ({ concept }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleIsExpanded = () => {
        setIsExpanded(!isExpanded);
    }

    return (
        <div className={classNames('concept', !isExpanded && 'collapsed')}>
            <button className="title" onClick={toggleIsExpanded}>
                {
                    concept.logoUrl && (
                        <img src={concept.logoUrl} alt={`Logo for concept ${concept.name}`}/>
                    )
                }
                {concept.name}
                <ExpandIcon isExpanded={isExpanded}/>
            </button>
            <ConceptMenu menuItemsByCategoryName={concept.menu}/>
        </div>
    );
};