import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { SearchTypes } from '@msdining/common';
import { ApplicationContext } from '../../../../context/app.ts';
import { getSearchAnchorId, getViewMenuUrlDirect } from '../../../../util/link.ts';

interface IStationItemGroupProps {
    stationName: string;
    cafeId?: string;
    children: React.ReactNode;
}

export const StationItemGroup: React.FC<IStationItemGroupProps> = ({ stationName, cafeId, children }) => {
    const { viewsById } = useContext(ApplicationContext);

    const stationUrl = useMemo(() => {
        if (!stationName || cafeId == null) {
            return undefined;
        }
        const view = viewsById.get(cafeId);
        if (view == null) {
            return undefined;
        }
        const anchor = getSearchAnchorId({
            cafeId,
            entityType: SearchTypes.SearchEntityType.station,
            name:       normalizeNameForSearch(stationName),
        });
        return `${getViewMenuUrlDirect(view)}#${anchor}`;
    }, [stationName, cafeId, viewsById]);

    return (
        <>
            <tr>
                <th colSpan={4} className="station-subheader">
                    {stationUrl != null
                        ? <Link to={stationUrl}>{stationName}</Link>
                        : stationName || 'Other'
                    }
                </th>
            </tr>
            {children}
        </>
    );
};
