import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { getDiningHallMenuUrl } from '../../util/link.ts';
import './search.css';
import { ApplicationContext } from '../../context/app.ts';

interface ISearchResultProps {
    name: string;
    diningHallIds: string[];
}

export const SearchResult: React.FC<ISearchResultProps> = ({ name, diningHallIds }) => {
    const { diningHallsById } = useContext(ApplicationContext);

    return (
        <div className="card search-result">
            <div className="title">{name}</div>
            <div className="body search-result-hits">
                {
                    diningHallIds.map(id => {
                        const diningHall = diningHallsById.get(id);

                        if (!diningHall) {
                            return false;
                        }

                        return (
                            <Link to={getDiningHallMenuUrl(diningHall)} className="search-result-chip" key={diningHall.id}>
                                {diningHall.name}
                            </Link>
                        );
                    })
                }
            </div>
        </div>
    );
};