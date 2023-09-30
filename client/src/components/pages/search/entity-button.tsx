import React from 'react';

import { classNames } from '../../../util/react.ts';

interface IEntityButtonProps {
    name: string;
    isChecked: boolean;

    onClick(): void;
}

export const EntityButton: React.FC<IEntityButtonProps> = ({ name, isChecked, onClick }) => {
    const htmlId = `entity-button-${name}`;

    return (
        <div className={classNames('entity-button', isChecked && 'active')} onClick={onClick}>
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
        </div>
    );
}