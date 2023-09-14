import React from 'react';

interface IMaterialIconProps {
    name: string;
}

export const MaterialIcon: React.FC<IMaterialIconProps> = ({ name }) => {
    return (
        <span className="material-symbols-outlined material-icon">
            {name}
        </span>
    );
};