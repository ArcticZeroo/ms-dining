import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { MapCafeViewDetails } from './map-cafe-view-details.tsx';
import { MapSelectedViewContext } from '../../../context/map.ts';
import { FavoriteItemButton } from '../../button/favorite/favorite-item-button.tsx';

interface IMapCafeViewPopupProps {
    view: CafeView;
    showAllStations?: boolean;
    onClose(): void;
}

export const MapCafeViewPopup: React.FC<IMapCafeViewPopupProps> = ({ view, showAllStations = false, onClose }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const onPaddingClicked = () => {
        onClose();
    };

    const onContentClicked = (event: React.MouseEvent) => {
        // don't let the parent know that we clicked, that would close the popup
        event.stopPropagation();
    };

    return (
        <MapSelectedViewContext.Provider value={view}>
            <div className="cafe-popup flex flex-center default-padding fade-in" onClick={onPaddingClicked}>
                <div className="body flex-col default-container" onClick={onContentClicked}>
                    <div className="flex flex-between">
                        <FavoriteItemButton
                            setting={ApplicationSettings.homepageViews}
                            name={view.value.id}
                        />
                        <span>
                            {
                                getViewName({
                                    view,
                                    showGroupName: true,
                                    includeEmoji: true
                                })
                            }
                        </span>
                        <button onClick={onClose}
                            className="default-button default-container icon-container close-button">
                            <span className="material-symbols-outlined">
                            close
                            </span>
                        </button>
                    </div>
                    <MapCafeViewDetails
                        view={view}
                        showAllStations={showAllStations}
                    />
                    {
                        (shouldUseGroups || view.type === CafeViewType.single) && (
                            <div className="flex flex-center">
                                <Link
                                    to={getViewMenuUrl({
                                        view,
                                        viewsById,
                                        shouldUseGroups
                                    })}
                                    className="default-button default-container text-center view-menu"
                                >
                                    View Entire Menu
                                </Link>
                            </div>
                        )
                    }
                </div>
            </div>
        </MapSelectedViewContext.Provider>
    );
};