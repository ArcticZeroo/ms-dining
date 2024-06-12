import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { getCafeName, getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { expandAndFlattenView } from '../../../util/view.ts';
import { CafePopupOverview } from './overview/cafe-popup-overview.tsx';

interface ICafePopupProps {
    view: CafeView;
    onClose(): void;
}

export const CafePopup: React.FC<ICafePopupProps> = ({ view, onClose }) => {
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
        // Outer container for the interactive padding
        <div className="cafe-popup flex flex-center default-padding" onClick={onPaddingClicked}>
            <div className="body flex-col height-full default-container" onClick={onContentClicked}>
                <div className="flex flex-between">
                    <span className="text-center">
                        {
                            getViewName({
                                view,
                                showGroupName: true,
                                includeEmoji:  true
                            })
                        }
                    </span>
                    <button onClick={onClose} className="default-button default-container">
                        <span className="material-symbols-outlined">
                        close
                        </span>
                    </button>
                </div>
                <div className="group-member-list flex flex-wrap flex-center">
                    {
                        cafesInView.map(cafe => (
                            <div className="group-member flex-col" key={cafe.id}>
                                {
                                    view.type === CafeViewType.group && (
                                        <span>
                                            {getCafeName({ cafe, showGroupName: false, includeEmoji: true })}
                                        </span>
                                    )
                                }
                                <CafePopupOverview cafe={cafe}/>
                            </div>
                        ))
                    }
                </div>
                {
                    (shouldUseGroups || view.type === CafeViewType.single) && (
                        <Link to={getViewMenuUrl({
                            view,
                            viewsById,
                            shouldUseGroups
                        })} className="default-button default-container text-center view-menu">
                                                                                   View menu
                        </Link>
                    )
                }
            </div>
        </div>
    );
}