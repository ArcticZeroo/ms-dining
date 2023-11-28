import React from 'react';
import { CafeView } from '../../../models/cafe.ts';

interface IHomepageViewChipProps {
	view: CafeView;
	homepageViewIds: Set<string>;
	onToggleClicked(): void;
}

export const HomepageViewChip: React.FC<IHomepageViewChipProps> = ({ view, homepageViewIds, onToggleClicked }) => {
	const viewId = view.value.id;
	const htmlId = `setting-homepage-option-${viewId}`;
	const isChecked = homepageViewIds.has(viewId);
	return (
		<div className="setting-chip" key={viewId}>
			<label htmlFor={htmlId}>
				{view.value.name}
			</label>
			<input type="checkbox"
				   id={htmlId}
				   checked={isChecked}
				   onChange={onToggleClicked}/>
		</div>
	);
}