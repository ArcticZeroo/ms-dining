import { ErrorCard } from '../card/error.tsx';
import { useNavigate } from 'react-router-dom';
import React from 'react';

export const NotFoundPage = () => {
    const navigate = useNavigate();

    const onButtonClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        navigate('/');
    };

    return (
        <ErrorCard>
            <div>
                Page not found!
            </div>
            <button onClick={onButtonClicked}>
                Navigate Home
            </button>
        </ErrorCard>
    );
};