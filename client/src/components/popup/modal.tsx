import React from 'react';
import { usePopupCloserAlways } from '../../hooks/popup.ts';

interface IModalProps {
    title: React.ReactNode;
    buttons?: React.ReactNode;
    body: React.ReactNode;
    footer?: React.ReactNode;
}

export const Modal: React.FC<IModalProps> = ({ title, buttons, body, footer }) => {
    const closePopup = usePopupCloserAlways();

    return (
        <div className="modal card">
            <div className="title">
                <div id="modal-title">{title}</div>
                <div id="modal-buttons">
                    {buttons}
                    <button onClick={closePopup} title="Click to close popup">
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