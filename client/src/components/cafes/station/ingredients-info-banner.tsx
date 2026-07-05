import React from 'react';
import './ingredients-menu-view.css';

export const IngredientsInfoBanner: React.FC = () => (
    <div className="card default-margin-bottom ingredients-info-banner">
        <span className="material-symbols-outlined">info</span>
        <span>
            in.gredients is a 3-course restaurant inside Café 34.
            Reservations are generally required, but you may be able to get a walk-up table if you&apos;re lucky.
            There are bar seats over by the salad bar that can&apos;t be reserved and are easier to get without a reservation.
        </span>
    </div>
);
