import { BooleanSetting } from '../../../api/settings.ts';
import React from 'react';
import { useValueNotifier } from '../../../hooks/events.ts';

interface IBooleanSettingInputProps {
	name: React.ReactElement | string;
	description?: React.ReactElement | string;
	setting: BooleanSetting;
	isChip?: boolean;
}

export const BooleanSettingInput: React.FC<IBooleanSettingInputProps> = ({
																			 name,
																			 description,
																			 setting,
																			 isChip = false
																		 }) => {
	const currentValue = useValueNotifier(setting);

	const toggleSetting = () => {
		setting.value = !currentValue;
	};

	const htmlId = `setting-${setting.name}`;

	if (isChip) {
		return (
			<div className="setting-chip">
				<label htmlFor={htmlId}>
					{name}
				</label>
				<input type="checkbox"
					   id={htmlId}
					   checked={currentValue}
					   onChange={toggleSetting}/>
			</div>
		);

	}

	return (
		<div className="setting">
			<label htmlFor={htmlId} className="setting-info">
				<div className="setting-name">
					{name}
				</div>
				{
					description && (
									<div className="setting-description">
										{description}
									</div>
								)
				}
			</label>
			<input type="checkbox"
				   id={htmlId}
				   checked={currentValue}
				   onChange={toggleSetting}/>
		</div>
	);
};