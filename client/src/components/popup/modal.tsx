import React, { useContext } from 'react';
import { PopupContext } from '../../context/modal.ts';

interface IModalProps {
    title: string;
    body: React.ReactNode;
    footer: React.ReactNode;
}

export const Modal: React.FC<IModalProps> = ({ title, body, footer }) => {
    const popupNotifier = useContext(PopupContext);

    const onCloseClicked = () => {
        popupNotifier.value = null;
    };

    return (
        <div className="modal card">
            <div className="title">
                <h2>{title}</h2>
                <button className="close" onClick={onCloseClicked}>
                            <span className="material-symbols-outlined">
                                close
                            </span>
                </button>
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