import { DeviceType, useDeviceType } from '../../hooks/media-query.js';
import React, { useContext } from 'react';
import { Modal } from '../popup/modal.js';
import { CafeOverviewWithData } from './cafe-overview-with-data.js';
import { CafeMenu } from '../../models/cafe.js';
import { IDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { usePopupOpener } from '../../hooks/popup.js';
import { CurrentCafeContext } from '../../context/menu-item.js';
import { classNames } from '../../util/react.js';

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

const getOverviewTitle = (menuData: IDelayedPromiseState<CafeMenu>, isDisabled: boolean) => {
    if (menuData.stage === PromiseStage.error) {
        return 'Menu overview is unavailable due to an error loading the menu';
    }

    if (menuData.stage === PromiseStage.success) {
        if (isDisabled) {
            return 'There are no stations on the menu today';
        }

        return 'Click to view menu overview';
    }

    return 'Overview will be ready once the menu has loaded';
}

interface ICafeMenuControlsProps {
    cafeName: string;
    menuData: IDelayedPromiseState<CafeMenu>;
}

export const CafeMenuControls: React.FC<ICafeMenuControlsProps> = ({ cafeName, menuData }) => {
    const cafe = useContext(CurrentCafeContext);
    const openPopup = usePopupOpener();
    const deviceType = useDeviceType();

    const stations = menuData.value?.stations;
    const isOverviewDisabled = !stations || stations.length === 0;
    const overviewTitle = getOverviewTitle(menuData, isOverviewDisabled);

    const onOpenMenuOverviewClicked = () => {
        if (!stations || stations.length === 0) {
            return;
        }

        openPopup({
            id:   menuOverviewSymbol,
            body: (
                <Modal
                    title={`Menu Overview for ${cafeName}`}
                    body={
                        <CafeOverviewWithData
                            cafe={cafe}
                            overviewStations={stations}
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
                disabled={isOverviewDisabled}
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