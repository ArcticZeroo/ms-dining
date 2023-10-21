import { CafeMenu, ICafe } from '../../models/cafe.ts';
import React, { useEffect, useState } from 'react';
import { StationList } from './station/station-list.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

interface ICollapsibleCafeMenuProps {
    cafe: ICafe;
    menu: CafeMenu;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = ({
                                                                             cafe,
                                                                             menu,
                                                                         }) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const rememberCollapseState = useValueNotifier(ApplicationSettings.rememberCollapseState);
    const collapsedCafeIds = useValueNotifier(ApplicationSettings.collapsedCafeIds);
    const [isExpanded, setIsExpanded] = useState(() => {
        if (rememberCollapseState) {
            return !collapsedCafeIds.has(cafe.id);
        }

        return true;
    });

    useEffect(() => {
        if (rememberCollapseState) {
            console.log('collapsedCafeIds', collapsedCafeIds);
            const isCollapsed = collapsedCafeIds.has(cafe.id);
            setIsExpanded(!isCollapsed);
        }
    }, [rememberCollapseState, collapsedCafeIds]);

    const toggleIsExpanded = () => {
        const isNowExpanded = !isExpanded;

        if (rememberCollapseState) {
            const newCollapsedCafeIds = new Set(collapsedCafeIds);
            if (isNowExpanded) {
                newCollapsedCafeIds.delete(cafe.id);
            } else {
                newCollapsedCafeIds.add(cafe.id);
            }

            ApplicationSettings.collapsedCafeIds.value = newCollapsedCafeIds;
        } else {
            setIsExpanded(isNowExpanded);
        }
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
                        showImages && (
                            <img src={cafe.logoUrl}
                                 alt={`${cafe.name} logo`}
                                 className="logo"/>
                        )
                    }
                    {cafe.name} Menu
                    <ExpandIcon isExpanded={isExpanded}/>
                </button>
            </div>
            <StationList stations={menu} isVisible={isExpanded}/>
        </div>
    );
};