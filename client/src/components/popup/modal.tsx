import { useValueNotifier } from '../../hooks/events.ts';
import { ModalContext } from '../../context/modal.ts';
import React, { useContext } from 'react';

import './popup.css';

export const Modal = () => {
    const modalNotifier = useContext(ModalContext);
    const modal = useValueNotifier(modalNotifier);

    if (modal == null) {
        return null;
    }

    const onOverlayClicked = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            modalNotifier.value = null;
        }
    };

    const onCloseClicked = () => {
        modalNotifier.value = null;
    };

    return (
        <div id="top-overlay" onClick={onOverlayClicked}>
            {/* Avoids the modal being vertically stretched in the flexbox*/}
            <div id="modal-wrapper" onClick={onOverlayClicked}>
                <div className="modal card">
                    <div className="title">
                        <h2>{modal.title}</h2>
                        <button className="close" onClick={onCloseClicked}>
                            <span className="material-symbols-outlined">
                                close
                            </span>
                        </button>
                    </div>
                    <div className="body">
                        {modal.body}
                    </div>
                </div>
            </div>
        </div>
    );
};