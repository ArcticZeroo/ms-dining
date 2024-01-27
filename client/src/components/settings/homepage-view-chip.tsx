import React from 'react';

interface IHomepageViewChipProps {
    viewName: string;
    viewId: string;
    homepageViewIds: Set<string>;

    onToggleClicked(): void;
}

export const HomepageViewChip: React.FC<IHomepageViewChipProps> = ({
    viewName,
    viewId,
    homepageViewIds,
    onToggleClicked
}) => {
    const htmlId = `setting-homepage-option-${viewId}`;
    const isChecked = homepageViewIds.has(viewId);

    return (
        <label htmlFor={htmlId} className="setting-chip" key={viewId}>
            {viewName}
            <input type="checkbox"
                id={htmlId}
                checked={isChecked}
                onChange={onToggleClicked}/>
        </label>
    );
};