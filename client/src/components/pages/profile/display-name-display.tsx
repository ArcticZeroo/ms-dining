import React from 'react';

interface IDisplayNameDisplayProps {
    displayName: string;
    onStartEdit: () => void;
}

export const DisplayNameDisplay: React.FC<IDisplayNameDisplayProps> = ({ displayName, onStartEdit }) => {
    return (
        <div onDoubleClick={onStartEdit} className="flex">
            <span className="flex-grow">
                {displayName}
            </span>
            <button onClick={onStartEdit} className="default-button default-container flex">
                <span className="material-symbols-outlined">
                    edit
                </span>
                <span>
                    Edit
                </span>
            </button>
        </div>
    );
};
