import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { type ICompletedCafeSummary } from '../../../hooks/cart-snapshot.ts';
import { getViewName } from '../../../util/cafe.ts';

interface ICompletedCafesListProps {
    completedCafes: ICompletedCafeSummary[];
}

export const CompletedCafesList: React.FC<ICompletedCafesListProps> = ({ completedCafes }) => {
    const { viewsById } = useContext(ApplicationContext);

    if (completedCafes.length === 0) {
        return null;
    }

    return (
        <div className="card dark-blue order-page-completed-list">
            <div className="title">Completed Cafes</div>
            {completedCafes.map((completedCafe) => {
                const view = viewsById.get(completedCafe.cafeId);
                const cafeName = view != null
                    ? getViewName({ view, showGroupName: true })
                    : completedCafe.cafeId;

                return (
                    <div key={completedCafe.cafeId} className="order-page-completed-badge">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>
                            {cafeName} paid — Order #{completedCafe.buyOnDemandOrderNumber}
                        </span>
                    </div>
                );
            })}
            <div className="order-page-completed-link">
                <Link to="/order/done" className="default-container default-button">
                    View Today&apos;s Orders
                </Link>
            </div>
        </div>
    );
};
