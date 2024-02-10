import React, { useMemo, useState } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ICafe } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';
import { ScrollAnchor } from '../button/scroll-anchor.tsx';
import { ExpandIcon } from '../icon/expand.tsx';
import { CollapsibleCafeMenuBody } from './collapsible-cafe-menu-body.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';

const useCafeName = (cafe: ICafe, showGroupName: boolean) => {
    return useMemo(() => getCafeName(cafe, showGroupName), [cafe, showGroupName]);
};

interface ICollapsibleCafeMenuProps {
    cafe: ICafe;
    showGroupName: boolean;
    shouldCountTowardsLastUsed: boolean;
}

export const CollapsibleCafeMenu: React.FC<ICollapsibleCafeMenuProps> = (
    {
        cafe,
        showGroupName,
        shouldCountTowardsLastUsed
    }) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);

    const [isExpanded, setIsExpanded] = useState(() => !ApplicationSettings.collapseCafesByDefault.value);
    const showCafeLogo = showImages && cafe.logoUrl != null;
    const cafeName = useCafeName(cafe, showGroupName);

    const toggleIsExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <CurrentCafeContext.Provider value={cafe}>
            <div className={classNames('collapsible-content collapsible-cafe flex-col', !isExpanded && 'collapsed')}
                key={cafe.id}>
                <div className="cafe-header">
                    <a className="cafe-order-link"
                        href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
                        target="_blank">
                        <span className="material-symbols-outlined">
                                open_in_new
                        </span>
                    </a>
                    <ScrollAnchor id={cafe.id}/>
                    <button className="collapse-toggle cafe-name" onClick={toggleIsExpanded}>
                        {
                            showCafeLogo && (
                                <img src={cafe.logoUrl}
                                    alt={`${cafe.name} logo`}
                                    className="logo"
                                />
                            )
                        }
                        {cafeName}
                        <ExpandIcon isExpanded={isExpanded}/>
                    </button>
                </div>
                <CollapsibleCafeMenuBody
                    isExpanded={isExpanded}
                    shouldCountTowardsLastUsed={shouldCountTowardsLastUsed}
                />
            </div>
        </CurrentCafeContext.Provider>
    );
};