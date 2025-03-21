import { useCallback, useContext } from 'react';
import { IPopupContext, PopupContext } from '../context/modal.ts';
import { useNavigate } from 'react-router-dom';

export const usePopupOpener = () => {
    const popupNotifier = useContext(PopupContext);
    const navigate = useNavigate();

    return useCallback(
        (popup: IPopupContext) => {
            popupNotifier.value = popup;
            navigate('#popup');
        },
        [popupNotifier, navigate]
    );
};

export const usePopupCloserSymbol = () => {
    const popupNotifier = useContext(PopupContext);
    const navigate = useNavigate();

    return useCallback(
        (id: symbol) => {
            if (id != null && popupNotifier.value?.id !== id) {
                return;
            }

            navigate('#');
        },
        [popupNotifier, navigate]
    );
};

export const usePopupCloserAlways = () => {
    const navigate = useNavigate();

    return useCallback(
        () => {
            navigate('#');
        },
        [navigate]
    );
}