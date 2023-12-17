import { ApplicationContext } from '../../context/app.ts';
import { CafeMenu, ICafe } from '../../models/cafe.ts';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { StationList } from './station/station-list.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    const { viewsById } = useContext(ApplicationContext);

    return useMemo(() => {
        if (!showGroupName || !cafe.group) {
            return cafe.name;
        }

        const groupView = viewsById.get(cafe.group);
        if (!groupView) {
            return cafe.name;
        }

        const groupName = groupView.value.name;

        if (cafe.name === groupName) {
            return cafe.name;
        }

        return `${cafe.name} (${groupName})`;
    }, [cafe, viewsById, showGroupName]);
}

interface ICollapsibleCafeMenuProps {
    cafe: ICafe;
    menu: CafeMenu;
    showGroupName: boolean;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = ({
                                                                             cafe,
                                                                             menu,
                                                                             showGroupName
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
        <div className="collapsible-cafe" key={cafe.id}>
            <div className="cafe-header">
                <a className="cafe-order-link"
                   href={`https://${cafe.id}.buy-ondemand.com`}
                   target="_blank">
                    <span className="material-symbols-outlined">
                            open_in_new
                    </span>
                </a>
                <button className="cafe-name" onClick={toggleIsExpanded}>
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
            <StationList stations={menu} isVisible={isExpanded}/>
        </div>
    );
};