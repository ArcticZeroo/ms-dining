import { DeviceType, useDeviceType } from '../../hooks/media-query.js';
import React, { useContext } from 'react';
import { Modal } from '../popup/modal.js';
import { CafeOverview } from './cafe-overview.js';
import { usePopupOpener } from '../../hooks/popup.js';
import { CurrentCafeContext } from '../../context/menu-item.js';
import { classNames } from '../../util/react.js';
import { ICafeMenuView } from './cafe-menu-view.js';

const menuOverviewSymbol = Symbol();

const getOrderButtonText = (cafeId: string, deviceType: DeviceType): string => {
    const baseText = cafeId === 'in-gredients' ? 'Reserve / Order' : 'Order';
    return deviceType === DeviceType.Desktop ? `${baseText} Online` : baseText;
}

const getOrderButtonTitle = (cafeId: string): string => {
    if (cafeId === 'in-gredients') {
        return 'Click to open reservation and online ordering menu';
    }

    return 'Click to open online ordering menu at buy-ondemand.com';
}

const getOverviewTitle = (menuData: ICafeMenuView, isDisabled: boolean) => {
    if (menuData.isError) {
        return 'Menu overview is unavailable due to an error loading the menu';
    }

    if (menuData.data != null) {
        if (isDisabled) {
            return 'There are no stations on the menu today';
        }

        return 'Click to view menu overview';
    }

    return 'Overview will be ready once the menu has loaded';
}

interface ICafeMenuControlsProps {
    cafeName: string;
    menuData: ICafeMenuView;
}

export const CafeMenuControls: React.FC<ICafeMenuControlsProps> = ({ cafeName, menuData }) => {
    const cafe = useContext(CurrentCafeContext);
    const openPopup = usePopupOpener();
    const deviceType = useDeviceType();

    const stations = menuData.data?.stations;
    const shutdownState = menuData.data?.shutdownState;
    // A fully-closed cafe has no stations but still has a closure message to show,
    // so the overview is meaningful whenever there are stations OR a shutdown state.
    const hasOverviewContent = (stations?.length ?? 0) > 0 || shutdownState != null;
    const overviewTitle = getOverviewTitle(menuData, !hasOverviewContent);

    const onOpenMenuOverviewClicked = () => {
        if (!hasOverviewContent) {
            return;
        }

        openPopup({
            id:   menuOverviewSymbol,
            body: (
                <Modal
                    title={`Menu Overview for ${cafeName}`}
                    body={
                        <CafeOverview
                            cafe={cafe}
                            stations={stations}
                            shutDownState={shutdownState}
                            showAllStations={true}
                        />
                    }
                />
            )
        });
    };

    const childElementClassName = classNames(
        'default-button default-container flex',
        deviceType === DeviceType.Desktop && 'self-stretch'
    );

    const onControlsClicked = (event: React.MouseEvent) => {
        // This component sometimes is included in the header itself, so prevent collapse/expansion toggle
        event.stopPropagation();
    }

    const orderButtonText = getOrderButtonText(cafe.id, deviceType);

    return (
        <div
            className={classNames('flex flex-around flex-wrap force-base-font-size cafe-header-controls', deviceType === DeviceType.Desktop && 'in-header')}
            onClick={onControlsClicked}
        >
            <a
                className={childElementClassName}
                href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
                target="_blank"
                title={getOrderButtonTitle(cafe.id)}
            >
                <span className="material-symbols-outlined">
                    captive_portal
                </span>
                <span>
                    {orderButtonText}
                </span>
            </a>
            <button
                className={childElementClassName}
                title={overviewTitle}
                onClick={onOpenMenuOverviewClicked}
                disabled={!hasOverviewContent}
            >
                <span className="material-symbols-outlined">
                    menu_book_2
                </span>
                <span>
                    {deviceType === DeviceType.Desktop && 'Menu '}Overview
                </span>
            </button>
        </div>
    );
};