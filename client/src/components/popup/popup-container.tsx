import { useValueNotifier } from '../../hooks/events.ts';
import { PopupContext } from '../../context/modal.ts';
import React, { useContext, useEffect } from 'react';

import './popup.css';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { classNames } from '../../util/react.ts';

export const PopupContainer = () => {
    const popupNotifier = useContext(PopupContext);
    const popup = useValueNotifier(popupNotifier);
    const deviceType = useDeviceType();

    useEffect(() => {
        if (popup == null) {
            return;
        }

        const onEscapePressed = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                popupNotifier.value = null;
            }
        };

        document.addEventListener('keydown', onEscapePressed);

        return () => {
            document.removeEventListener('keydown', onEscapePressed);
        };
    }, [popupNotifier, popup]);

    if (popup == null) {
        return null;
    }

    const onOverlayClicked = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            popupNotifier.value = null;
        }
    };

    return (
        <div id="top-overlay"
            // On mobile things jump around when the popup is shown, so we don't fade it in
             className={classNames(deviceType === DeviceType.Desktop && 'fade-in')}
             onClick={onOverlayClicked}
        >
            {
                deviceType === DeviceType.Mobile && (
                    popup.body
                )
            }
            {
                deviceType === DeviceType.Desktop && (
                    // Avoids the popup being vertically stretched in the flexbox*
                    <div id="popup-wrapper" onClick={onOverlayClicked}>
                        {popup.body}
                    </div>
                )
            }
        </div>
    );
};