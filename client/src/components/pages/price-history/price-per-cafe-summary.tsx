import React, { useContext } from 'react';
import { IPriceCafeSummary } from '@msdining/common/models/price-history';
import { ApplicationContext } from '../../../context/app.ts';
import { tryGetViewName } from '../../../util/cafe.ts';
import { PriceCafeChip } from './price-cafe-chip.tsx';

interface IPricePerCafeSummaryProps {
    perCafe: IPriceCafeSummary[];
}

export const PricePerCafeSummary: React.FC<IPricePerCafeSummaryProps> = ({ perCafe }) => {
    const { viewsById } = useContext(ApplicationContext);

    return (
        <div className="flex-col price-percafe">
            <span className="price-change-list-title">
                Average increase by cafe
            </span>
            <div className="flex flex-wrap price-percafe-grid">
                {
                    perCafe.map(cafe => (
                        <PriceCafeChip
                            key={cafe.cafeId}
                            cafe={cafe}
                            cafeName={tryGetViewName({ cafeId: cafe.cafeId, viewsById, showGroupName: true })}
                        />
                    ))
                }
            </div>
        </div>
    );
};
