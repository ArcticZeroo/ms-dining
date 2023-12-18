import React from 'react';
import { CheapItemsSortType } from '../../../models/search.ts';
import { classNames } from '../../../util/react.ts';

interface ISortButtonProps {
    name: string;
    currentSort: CheapItemsSortType;
    type: CheapItemsSortType;

    onClick(): void;
}

export const SortButton: React.FC<ISortButtonProps> = ({ name, currentSort, type, onClick }) => {
    const htmlId = `sort-button-${name}`;
    const isChecked = type === currentSort;

    return (
        <button className={classNames('filter-button', isChecked && 'active')}
                onClick={onClick}>
            <input type="radio"
                   name="entity-type"
                   id={htmlId}
                   title={name}
                   value={name}
                   checked={isChecked}
                   readOnly={true}
            />
            <label htmlFor={htmlId}>
                {name}
            </label>
        </button>
    );
}