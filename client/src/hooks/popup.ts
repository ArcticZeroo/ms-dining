import { useCallback, useContext } from 'react';
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

export const usePopupCloserSymbol = () => {
    const popupNotifier = useContext(PopupContext);
    const navigate = usePartialNavigate();

    return useCallback(
        (id: symbol) => {
            if (id != null && popupNotifier.value?.id !== id) {
                return;
            }

            navigate({
                hash: ''
            });
        },
        [popupNotifier, navigate]
    );
};

export const usePopupCloserAlways = () => {
    const navigate = usePartialNavigate();

    return useCallback(
        () => {
            navigate({
                hash: ''
            });
        },
        [navigate]
    );
}