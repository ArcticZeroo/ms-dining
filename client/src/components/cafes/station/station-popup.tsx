import React from 'react';
import { Modal } from '../../popup/modal.tsx';
import { StationReviewsView } from './station-reviews-view.tsx';

interface IStationPopupProps {
    stationId: string;
    stationName: string;
    stationLogoUrl?: string | null;
    cafeId: string;
    modalSymbol: symbol;
}

export const StationPopup: React.FC<IStationPopupProps> = ({
    stationId,
    stationName,
    stationLogoUrl,
    cafeId,
}) => {

    return (
        <Modal
            title={stationName}
            body={(
                <div className="flex-col">
                    {
                        stationLogoUrl && (
                            <img
                                src={stationLogoUrl}
                                alt={`Logo for ${stationName}`}
                                className="station-logo"
                                style={{ alignSelf: 'center', maxHeight: '64px' }}
                            />
                        )
                    }
                    <StationReviewsView
                        stationId={stationId}
                        stationName={stationName}
                        cafeId={cafeId}
                    />
                </div>
            )}
        />
    );
};
