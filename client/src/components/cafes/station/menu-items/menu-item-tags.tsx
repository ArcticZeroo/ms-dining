import React, { useMemo } from 'react';
import { knownTags } from '../../../../constants/tags.tsx';

interface IMenuItemTagsProps {
	tags: string[];
}

export const MenuItemTags: React.FC<IMenuItemTagsProps> = ({ tags }) => {
	const tagElements = useMemo(
		() => tags.map(tagId => {
			const tagData = knownTags[tagId];

			if (tagData == null) {
				console.log('could not get tag data for tag', tagId, tags);

				return (
					<div className="menu-item-tag" key={tagId}>
						{tagId}
					</div>
				);
			}

			return (
				<div className="menu-item-tag" key={tagId} style={{ backgroundColor: tagData.color }}>
					{tagData.icon} {tagData.name}
				</div>
			);
		}),
		[tags]
	);

	return (
		<div className="menu-item-tags">
			{tagElements}
		</div>
	);
};