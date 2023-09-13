import { IDiningHallConcept } from '../../../models/dining-halls.ts';
import React from 'react';

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
            {
                Object.keys(concept.menu).map(categoryName => (
                    <div key={categoryName}>
                        <div>{categoryName}</div>
                        <ul>
                            {
                                concept.menu[categoryName].map(item => (
                                    <li key={item.id}>
                                        {item.displayName}  | ${item.price} | Calories {item.calories}-{item.maxCalories}
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                ))
            }
        </div>
    );
};