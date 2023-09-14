import { useNavigate } from 'react-router-dom';
import React from 'react';

export const NotFoundPage = () => {
    const navigate = useNavigate();

    const onButtonClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        navigate('/');
    };

    return (
        <div className="error-card">
            <div>
                Page not found!
            </div>
            <button onClick={onButtonClicked}>
                Navigate Home
            </button>
        </div>
    );
};