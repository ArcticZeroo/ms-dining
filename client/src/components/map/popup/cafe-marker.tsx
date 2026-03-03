import L from 'leaflet';
import React, { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { MarkerLabelMode } from '../../../util/map.ts';
import { toLeafletLocation } from '../../../util/coordinates.ts';
import { classNames } from '../../../util/react.ts';
import { getViewLocation, getViewMarkerLabel } from '../../../util/view.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { CafeMarkerTooltipContent } from './cafe-marker-tooltip-content.tsx';
import { emptyIfFalsy } from '../../../util/string.js';

const HOMEPAGE_VIEW_Z_INDEX = 1000;

interface IViewIconHtmlOptions {
    view: CafeView;
    labelText: string | null;
    isHomepageView: boolean;
    isRecentlyOpened: boolean;
    isHighlighted: boolean;
    isSelected: boolean;
    isFilterSelected: boolean;
    isDimmed: boolean;
}

const getIconHtml = ({ view, labelText, isHomepageView, isRecentlyOpened, isHighlighted, isSelected, isFilterSelected, isDimmed }: IViewIconHtmlOptions) => {
    const { text, isNumber, isShortText, emojiBadge } = getViewMarkerLabel(view);

    return `
<div class="${classNames('cafe-marker-container', (isNumber || isShortText) && 'has-number', isHomepageView && 'is-homepage-view', isRecentlyOpened && 'recently-opened', isHighlighted && 'is-highlighted', isSelected && 'is-selected', isFilterSelected && 'is-filter-selected', isDimmed && 'is-dimmed')}">
    <div class="cafe-marker-tracker flex flex-center" data-id="${view.value.id}">
        ${text}
    </div>
    ${emptyIfFalsy(emojiBadge && `<div class="cafe-marker-emoji">${emojiBadge}</div>`)}
    ${emptyIfFalsy(labelText && `<div class="cafe-name-label">${labelText}</div>`)}
</div>
`;
};

interface ICafeMarkerProps {
    view: CafeView;
    onClick(view: CafeView, isMultiSelect: boolean): void;
    labelMode?: MarkerLabelMode;
    isHighlighted?: boolean;
    isSelected?: boolean;
    isFilterSelected?: boolean;
    showTooltip?: boolean;
    isDimmed?: boolean;
}

export const CafeMarker: React.FC<ICafeMarkerProps> = ({ view, onClick, labelMode = 'none', isHighlighted = false, isSelected = false, isFilterSelected = false, showTooltip = false, isDimmed = false }) => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const isHomepageView = useMemo(
        () => {
            return homepageViewIds.has(view.value.id)
                   || (!shouldUseGroups
                       && view.type === CafeViewType.group
                       && view.value.members.some(member => homepageViewIds.has(member.id)));
        },
        [homepageViewIds, shouldUseGroups, view]
    );

    const isRecentlyOpened = useMemo(
        () => {
            if (view.type === CafeViewType.group) {
                return view.value.members.some(member => getIsRecentlyAvailable(member.firstAvailableDate));
            }

            return getIsRecentlyAvailable(view.value.firstAvailableDate);
        },
        [view]
    );

    const labelText = useMemo(() => {
        if (labelMode === 'none') {
            return null;
        }

        const markerLabel = getViewMarkerLabel(view);

        // Numbered cafes never need labels — the number in the bubble is enough
        if (markerLabel.isNumber) {
            return null;
        }

        // Short text labels (H, A, D) only get full name labels, not short ones
        if (labelMode === 'short' && markerLabel.isShortText) {
            return null;
        }

        return getViewName({
            view,
            showGroupName: false,
            useShortNames: labelMode === 'short',
            includeEmoji:  false
        });
    }, [view, labelMode]);

    const iconHtml = useMemo(
        () => getIconHtml({ view, labelText, isHomepageView, isRecentlyOpened, isHighlighted, isSelected, isFilterSelected, isDimmed }),
        [view, labelText, isHomepageView, isRecentlyOpened, isHighlighted, isSelected, isFilterSelected, isDimmed]
    );

    const onContextMenu = (event: L.LeafletMouseEvent) => {
        event.originalEvent.preventDefault();

        if (homepageViewIds.has(view.value.id)) {
            ApplicationSettings.homepageViews.delete(view.value.id);
        } else {
            ApplicationSettings.homepageViews.add(view.value.id);
        }
    }

    return (
        <Marker
            position={toLeafletLocation(getViewLocation(view))}
            icon={L.divIcon({ html: iconHtml })}
            eventHandlers={{
                click: (event: L.LeafletMouseEvent) => onClick(view, event.originalEvent.ctrlKey || event.originalEvent.metaKey),
                contextmenu: onContextMenu
            }}
            zIndexOffset={isHomepageView ? HOMEPAGE_VIEW_Z_INDEX : 0}
        >
            {showTooltip && (
                <Tooltip direction="top" offset={[0, -10]} sticky={false}>
                    <CafeMarkerTooltipContent view={view}/>
                </Tooltip>
            )}
        </Marker>
    );
};