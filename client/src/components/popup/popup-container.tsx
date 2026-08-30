import { useValueNotifier } from '../../hooks/events.ts';
import { PopupContext } from '../../context/modal.ts';
import React, { useContext, useEffect } from 'react';

import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';
import { classNames } from '../../util/react.ts';
import { useLocationHash, usePartialNavigate } from '../../hooks/location.ts';
import { usePopupCloserAlways } from '../../hooks/popup.ts';

import './popup.css';

export const PopupContainer = () => {
    const popupNotifier = useContext(PopupContext);
    const popup = useValueNotifier(popupNotifier);
    const deviceType = useDeviceType();
    const hash = useLocationHash();
    const navigate = usePartialNavigate();
    const closePopup = usePopupCloserAlways();

    const isPopupHash = hash === '#popup';
    const isPopupActive = popup != null && isPopupHash;

    useEffect(() => {
        if (popup == null && isPopupHash) {
            // Replace (not push) so an orphaned #popup entry — e.g. reached by
            // Forward after a pop-close, or a direct deep-link — is overwritten
            // rather than re-stacked, which would trap the Back button on it.
            navigate({ hash: '' }, { replace: true });
            return;
        }

        // A popHistoryOnClose popup keeps its history entry in the forward stack
        // after we pop back out of it. Drop the stored popup once we've left it so
        // the Forward button can't re-render its (now stale) body.
        if (popup != null && !isPopupHash && popup.popHistoryOnClose) {
            popupNotifier.value = null;
        }
    }, [isPopupHash, navigate, popup, popupNotifier]);

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
            {/*
              * Render the body once, in a single stable position, so resizing across
              * the mobile/desktop breakpoint doesn't reparent (and therefore remount)
              * it — which would reload an open iframe and lose its state. On mobile the
              * wrapper collapses to `display: contents` so layout matches a bare child
              * of #top-overlay; on desktop it centers the modal to avoid vertical
              * stretch in the flexbox.
              */}
            <div id="popup-wrapper" onClick={onOverlayClicked}>
                {popup.body}
            </div>
        </div>
    );
};