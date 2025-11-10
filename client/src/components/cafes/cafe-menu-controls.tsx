import { DeviceType, useDeviceType } from '../../hooks/media-query.js';
import React, { useContext } from 'react';
import { Modal } from '../popup/modal.js';
import { CafePopupOverviewWithData } from './cafe-popup-overview-with-data.js';
import { CafeMenu } from '../../models/cafe.js';
import { IDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { usePopupOpener } from '../../hooks/popup.js';
import { CurrentCafeContext } from '../../context/menu-item.js';
import { classNames } from '../../util/react.js';

const menuOverviewSymbol = Symbol();

interface ICafeMenuControlsProps {
    cafeName: string;
    menuData: IDelayedPromiseState<CafeMenu>;
}

export const CafeMenuControls: React.FC<ICafeMenuControlsProps> = ({ cafeName, menuData }) => {
    const cafe = useContext(CurrentCafeContext);
    const openPopup = usePopupOpener();
    const deviceType = useDeviceType();
    const isOverviewDisabled = menuData.value && menuData.value.length === 0;
    const overviewTitle = isOverviewDisabled
        ? 'There are no stations on the menu today.'
        : 'Click to view menu overview';

    const onOpenMenuOverviewClicked = () => {
        const stations = menuData.value;
        if (!stations || stations.length === 0) {
            return;
        }

        openPopup({
            id:   menuOverviewSymbol,
            body: (
                <Modal
                    title={`Menu Overview for ${cafeName}`}
                    body={
                        <CafePopupOverviewWithData
                            cafe={cafe}
                            overviewStations={stations}
                            showAllStationsIfNoneInteresting={true}
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

    return (
        <div
            className={classNames('flex flex-around flex-wrap force-base-font-size cafe-header-controls', deviceType === DeviceType.Desktop && 'in-header')}
            onClick={onControlsClicked}
        >
            <a
                className={childElementClassName}
                href={cafe.url || `https://${cafe.id}.buy-ondemand.com`}
                target="_blank"
                title="Click to open online ordering menu at buy-ondemand.com"
            >
                <span className="material-symbols-outlined">
                    captive_portal
                </span>
                <span>
                    Order{deviceType === DeviceType.Desktop && ' Online'}
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