import React from 'react';
import { IDiningHall } from '../../models/dining-halls.ts';
import { Link } from 'react-router-dom';
import { getDiningHallMenuUrl } from '../../util/link.ts';
import './search.css';

interface ISearchResultProps {
    name: string;
    diningHalls: IDiningHall[];
}

export const SearchResult: React.FC<ISearchResultProps> = ({ name, diningHalls }) => {
    return (
        <div className="card search-result">
            <div className="title">{name}</div>
            <div className="body">
                {
                    diningHalls.map(diningHall => (
                        <Link to={getDiningHallMenuUrl(diningHall)} className="search-result-chip">
                            {diningHall.name}
                        </Link>
                    ))
                }
            </div>
        </div>
    );
};