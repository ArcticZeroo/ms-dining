import { IMenuItem } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import React, { useContext } from 'react';
import { CurrentCafeContext, StationInfoContext } from '../../../../context/menu-item.ts';
import { useIsFavoriteItem, useIsOnlineOrderingAllowed } from '../../../../hooks/cafe.ts';
import { useMenuItemHighlightTag } from '../../../../hooks/menu-item.ts';
import { usePopupOpener } from '../../../../hooks/popup.ts';
import { classNames } from '../../../../util/react.ts';
import { MenuItemPopup } from './popup/menu-item-popup.tsx';

const menuItemModalSymbol = Symbol('menuItem');

interface IMenuItemCardProps {
    menuItem: IMenuItem;
    children: React.ReactNode;
}

export const MenuItemCard: React.FC<IMenuItemCardProps> = ({ menuItem, children }) => {
    const cafe = useContext(CurrentCafeContext);
    const stationInfo = useContext(StationInfoContext);
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();
    const isFavoriteItem = useIsFavoriteItem(menuItem.name, SearchEntityType.menuItem);
    const highlightTag = useMenuItemHighlightTag(menuItem);
    const openModal = usePopupOpener();

    const onOpenModalClick = () => {
        openModal({
            id:   menuItemModalSymbol,
            body: <MenuItemPopup
                cafeId={cafe.id}
                menuItem={menuItem}
                modalSymbol={menuItemModalSymbol}
                stationId={stationInfo.id}
                stationName={stationInfo.name}
            />,
        });
    };

    const title = isOnlineOrderingAllowed
        ? 'Click to open item details (online ordering enabled)'
        : 'Click to open item details';

    return (
        <div
            className={classNames('flex-col menu-item pointer', isFavoriteItem && 'is-favorite')}
            onClick={onOpenModalClick}
            title={title}
            style={{ backgroundColor: highlightTag?.color }}
        >
            {children}
        </div>
    );
};
