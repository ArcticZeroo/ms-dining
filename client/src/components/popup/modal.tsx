import React, { useContext } from 'react';
import { PopupContext } from '../../context/modal.ts';

interface IModalProps {
    title: React.ReactNode;
    buttons?: React.ReactNode;
    body: React.ReactNode;
    footer: React.ReactNode;
}

export const Modal: React.FC<IModalProps> = ({ title, buttons, body, footer }) => {
    const popupNotifier = useContext(PopupContext);

    const onCloseClicked = () => {
        popupNotifier.value = null;
    };

    return (
        <div className="modal card">
            <div className="title">
                <div id="modal-title">{title}</div>
                <div id="modal-buttons">
                    {buttons}
                    <button onClick={onCloseClicked} title="Click to close popup">
                        <span className="material-symbols-outlined">
                            close
                        </span>
                    </button>
                </div>
            </div>
            <div className="body">
                {body}
            </div>
            {
                footer != null && (
                    <div className="footer">
                        {footer}
                    </div>
                )
            }
        </div>
    );
}