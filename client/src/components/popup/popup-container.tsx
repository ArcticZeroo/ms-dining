import { useValueNotifier } from '../../hooks/events.ts';
import { PopupContext } from '../../context/modal.ts';
import React, { useContext } from 'react';

import './popup.css';

export const PopupContainer = () => {
    const popupNotifier = useContext(PopupContext);
    const popup = useValueNotifier(popupNotifier);

    if (popup == null) {
        return null;
    }

    const onOverlayClicked = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            popupNotifier.value = null;
        }
    };

    return (
        <div id="top-overlay" onClick={onOverlayClicked}>
            {/* Avoids the popup being vertically stretched in the flexbox*/}
            <div id="popup-wrapper" onClick={onOverlayClicked}>
                {popup.body}
            </div>
        </div>
    );
};