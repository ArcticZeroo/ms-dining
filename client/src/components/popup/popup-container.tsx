import { useValueNotifier } from '../../hooks/events.ts';
import { PopupContext } from '../../context/modal.ts';
import React, { useContext, useEffect } from 'react';

import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { classNames } from '../../util/react.ts';
import { useLocationHash } from '../../hooks/location.ts';
import { usePopupCloserSymbol } from '../../hooks/popup.ts';

import './popup.css';
import { useNavigate } from 'react-router-dom';

export const PopupContainer = () => {
    const popupNotifier = useContext(PopupContext);
    const popup = useValueNotifier(popupNotifier);
    const deviceType = useDeviceType();
    const hash = useLocationHash();
    const navigate = useNavigate();
    const closePopup = usePopupCloserSymbol();

    const isPopupActive = popup != null && hash === '#popup';

    useEffect(() => {
        if (popup == null) {
            navigate('#');
        }
    }, [navigate, popup]);

    useEffect(() => {
        if (!isPopupActive) {
            return;
        }

        const onEscapePressed = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                event.preventDefault();
                closePopup();
            }
        };

        document.addEventListener('keydown', onEscapePressed);

        return () => {
            document.removeEventListener('keydown', onEscapePressed);
        };
    }, [popupNotifier, isPopupActive, closePopup]);

    if (!isPopupActive) {
        return null;
    }

    const onOverlayClicked = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            closePopup();
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