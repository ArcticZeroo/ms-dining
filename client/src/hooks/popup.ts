import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { IPopupContext, PopupContext } from '../context/modal.ts';
import { usePartialNavigate } from './location.ts';

export const usePopupOpener = () => {
    const popupNotifier = useContext(PopupContext);
    const navigate = usePartialNavigate();

    return useCallback(
        (popup: IPopupContext) => {
            popupNotifier.value = popup;
            navigate({
                hash: 'popup'
            });
        },
        [popupNotifier, navigate]
    );
};

/**
 * Closes the popup, popping the pushed history entry (navigate(-1)) for popups
 * flagged `popHistoryOnClose` and otherwise pushing a hash-clear. Popping keeps
 * closing symmetric with opening: no duplicate entry and nothing left in the
 * back/forward stack to reopen.
 */
const useCloseNavigation = () => {
    const popupNotifier = useContext(PopupContext);
    const navigate = usePartialNavigate();
    const rawNavigate = useNavigate();

    return useCallback(
        () => {
            if (popupNotifier.value?.popHistoryOnClose) {
                rawNavigate(-1);
                return;
            }

            navigate({
                hash: ''
            });
        },
        [popupNotifier, navigate, rawNavigate]
    );
};

export const usePopupCloserSymbol = () => {
    const popupNotifier = useContext(PopupContext);
    const closeNavigation = useCloseNavigation();

    return useCallback(
        (id: symbol) => {
            if (id != null && popupNotifier.value?.id !== id) {
                return;
            }

            closeNavigation();
        },
        [popupNotifier, closeNavigation]
    );
};

export const usePopupCloserAlways = () => {
    return useCloseNavigation();
}