import React, { useMemo } from 'react';
import { knownTags } from '../../../../constants/tags.tsx';

interface IMenuItemTagsProps {
	tags: Set<string>;
    showName?: boolean;
}

export const MenuItemTags: React.FC<IMenuItemTagsProps> = ({ tags, showName = true }) => {
    const tagElements = useMemo(
        () => Array.from(tags).map(tagId => {
            const tagData = knownTags[tagId];

            if (tagData == null) {
                console.warn('could not get tag data for tag', tagId, tags);

                return (
                    <div className="menu-item-tag" key={tagId} title={tagId}>
                        {tagId}
                    </div>
                );
            }

            return (
                <div className="menu-item-tag" key={tagId} style={{ backgroundColor: tagData.color }} title={tagData.name}>
                    {tagData.icon} {showName && tagData.name}
                </div>
            );
        }),
        [showName, tags]
    );

    return (
        <div className="menu-item-tags">
            {tagElements}
        </div>
    );
};