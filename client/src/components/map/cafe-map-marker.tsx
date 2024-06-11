import L from 'leaflet';
import React, { useContext } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { getViewName } from '../../util/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';
import { toLeafletLocation } from '../../util/user-location.ts';
import { getViewEmoji, getViewLocation } from '../../util/view.ts';
import { CafeMapMarkerGroupMember } from './cafe-map-marker-group-member.tsx';

interface IMapMarkerProps {
    view: CafeView;
}


export const CafeMapMarker: React.FC<IMapMarkerProps> = ({ view }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    return (
        <Marker position={toLeafletLocation(getViewLocation(view))} icon={L.divIcon({ html: getViewEmoji(view) })}>
            <Popup>
                <div className="text-center">
                    {
                        getViewName({
                            view,
                            showGroupName: true,
                            includeEmoji:  true
                        })
                    }
                </div>
                {
                    view.type === CafeViewType.group && (
                        <div className="group-member-list">
                            {
                                view.value.members.map(member => (
                                    <CafeMapMarkerGroupMember key={member.id} cafe={member}/>
                                ))
                            }
                        </div>
                    )
                }
                {
                    (shouldUseGroups || view.type === CafeViewType.single) && (
                        <Link to={`/menu/${getViewMenuUrl({ view, viewsById, shouldUseGroups })}`} className="default-button default-container text-center view-menu">
                             View menu
                        </Link>
                    )
                }
            </Popup>
        </Marker>
    );
};