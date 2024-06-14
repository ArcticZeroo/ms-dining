import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { expandAndFlattenView } from '../../../util/view.ts';
import { CampusMapPopupMember } from './campus-map-popup-member.tsx';
import { MapPopupViewContext } from '../../../context/map.ts';

interface ICampusMapPopupProps {
    view: CafeView;

    onClose(): void;
}

export const CampusMapPopup: React.FC<ICampusMapPopupProps> = ({ view, onClose }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const cafesInView = useMemo(
        () => expandAndFlattenView(view, viewsById),
        [view, viewsById]
    );

    const onPaddingClicked = () => {
        onClose();
    };

    const onContentClicked = (event: React.MouseEvent) => {
        event.stopPropagation();
    };

    return (
        <MapPopupViewContext.Provider value={view}>
            <div className="cafe-popup flex flex-center default-padding fade-in" onClick={onPaddingClicked}>
                <div className="body flex-col height-full default-container" onClick={onContentClicked}>
                    <div className="flex flex-between">
                        {
                            getViewName({
                                view,
                                showGroupName: true,
                                includeEmoji: true
                            })
                        }
                        <button onClick={onClose}
                            className="default-button default-container icon-container close-button">
                            <span className="material-symbols-outlined">
                            close
                            </span>
                        </button>
                    </div>
                    <div className="group-member-list flex flex-wrap flex-center">
                        {
                            cafesInView.map(cafe => (
                                <CampusMapPopupMember
                                    key={cafe.id}
                                    cafe={cafe}
                                />
                            ))
                        }
                    </div>
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
                                    View Menu
                                </Link>
                            </div>
                        )
                    }
                </div>
            </div>
        </MapPopupViewContext.Provider>
    );
};