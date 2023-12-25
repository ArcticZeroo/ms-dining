import { useCallback, useMemo } from 'react';
import { ApplicationSettings } from '../../api/settings.ts';
import { knownTags } from '../../constants/tags.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
export const HighlightTagsSetting = () => {
	const selectedTags = useValueNotifier(ApplicationSettings.highlightTagNames);

	const onToggleClicked = useCallback((tagId: string) => {
		if (selectedTags.has(tagId)) {
			ApplicationSettings.highlightTagNames.delete(tagId);
		} else {
			ApplicationSettings.highlightTagNames.add(tagId);
		}
	}, [selectedTags]);

	const chipsElement = useMemo(
		() => {
			return (
				<div className="setting-chips">
					{
						Object.entries(knownTags).map(([tagId, tag]) => (
							<label htmlFor={`tag-${tagId}`} className="setting-chip" key={tagId} style={{ backgroundColor: tag.color }}>
								{tag.name}
								<input type="checkbox"
								       id={`tag-${tagId}`}
								       checked={selectedTags.has(tagId)}
								       onChange={() => onToggleClicked(tagId)}/>
							</label>
						))
					}
				</div>
			);
		},
		[onToggleClicked, selectedTags]
	);

	return (
		<div className="setting" id="setting-highlight-labels">
			<div className="setting-info">
				<div className="setting-name">
					<span className="material-symbols-outlined">
						book
					</span>
					Highlight Tags
				</div>
				<div className="setting-description">
					Menu items with any of these tags will be highlighted in menus.
				</div>
			</div>
			{chipsElement}
		</div>
	);
};