import React, { useEffect, useMemo, useState } from 'react';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeMenu, ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ExpandIcon } from '../icon/expand.tsx';
import { StationList } from './station/station-list.tsx';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
	return useMemo(() => getCafeName(cafe, showGroupName), [cafe, showGroupName]);
};

interface ICollapsibleCafeMenuProps {
	cafe: ICafe;
	menu: CafeMenu;
	showGroupName: boolean;
	isLoading?: boolean;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = (
	{
		cafe,
		menu,
		showGroupName,
		isLoading = false
	}) => {
	const showImages = useValueNotifier(ApplicationSettings.showImages);
	const rememberCollapseState = useValueNotifier(ApplicationSettings.rememberCollapseState);
	const collapsedCafeIds = useValueNotifier(ApplicationSettings.collapsedCafeIds);
	const [isExpanded, setIsExpanded] = useState(true);
	const showCafeLogo = showImages && cafe.logoUrl != null;
	const cafeName = useCafeName(cafe, showGroupName);

	// Collapse memory is a boot setting. Also allows one render for width consistency of stations.
	useEffect(() => {
		if (rememberCollapseState) {
			const isCollapsed = collapsedCafeIds.has(cafe.id);
			setIsExpanded(!isCollapsed);
		}
	}, []);

	const toggleIsExpanded = () => {
		const isNowExpanded = !isExpanded;

		if (isNowExpanded) {
			ApplicationSettings.collapsedCafeIds.delete(cafe.id);
		} else {
			ApplicationSettings.collapsedCafeIds.add(cafe.id);
		}

		setIsExpanded(isNowExpanded);
	};

	return (
		<div className={classNames('collapsible-content collapsible-cafe flex-col', !isExpanded && 'collapsed')} key={cafe.id}>
			<div className="cafe-header">
				<a className="cafe-order-link"
				   href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
				   target="_blank">
                    <span className="material-symbols-outlined">
                            open_in_new
                    </span>
				</a>
				<button className="collapse-toggle cafe-name" onClick={toggleIsExpanded}>
					{
						showCafeLogo && (
										 <img src={cafe.logoUrl}
											  alt={`${cafe.name} logo`}
											  className="logo"/>
									 )
					}
					{cafeName}
					<ExpandIcon isExpanded={isExpanded}/>
				</button>
			</div>
			{
				isLoading
				&& (
					<div className="centered-content collapse-body">
						<div className="loading-spinner"/>
						Loading menu...
					</div>
				)
			}
			{
				!isLoading && <StationList stations={menu} isVisible={isExpanded}/>
			}
		</div>
	);
};