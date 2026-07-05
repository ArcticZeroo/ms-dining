import React from 'react';
import { ITagData } from '../../constants/tags.tsx';

interface IHighlightTagChipProps {
    tagId: string;
    tag: ITagData;
    isSelected: boolean;
    onToggle: () => void;
}

export const HighlightTagChip: React.FC<IHighlightTagChipProps> = ({ tagId, tag, isSelected, onToggle }) => (
    <label htmlFor={`tag-${tagId}`} className="setting-chip flex" style={{ backgroundColor: tag.color }}>
        <span>
            {tag.icon}
        </span>
        <span>
            {tag.name}
        </span>
        <input
            type="checkbox"
            id={`tag-${tagId}`}
            checked={isSelected}
            onChange={onToggle}
        />
    </label>
);
