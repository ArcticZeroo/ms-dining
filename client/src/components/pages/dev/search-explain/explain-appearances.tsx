import { ISearchExplanationAppearance } from '@msdining/common/models/search';
import React from 'react';

interface IExplainAppearancesProps {
    appearances: ISearchExplanationAppearance[];
}

export const ExplainAppearances: React.FC<IExplainAppearancesProps> = ({ appearances }) => {
    if (appearances.length === 0) {
        return null;
    }

    return (
        <details className="explain-appearances">
            <summary>Appearances ({appearances.length})</summary>
            <ul>
                {appearances.map((appearance, index) => (
                    <li key={index}>{appearance.dateString} · {appearance.cafeId} · {appearance.stationName}</li>
                ))}
            </ul>
        </details>
    );
};
