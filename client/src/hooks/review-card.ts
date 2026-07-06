import { SearchEntityType } from '@msdining/common/models/search';
import type { IReview } from '@msdining/common/models/review';
import { fromDateString } from '@msdining/common/util/date-util';
import type React from 'react';
import { useContext, useState } from 'react';
import { DebugSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { UserContext } from '../context/auth.ts';
import { getReviewEntityName, isStationReview } from '../models/reviews.ts';
import type { IReviewLookup } from '../models/reviews.ts';
import { useDeleteReview } from '../store/queries/reviews.ts';
import { getViewName } from '../util/cafe.ts';
import { getSearchAnchorJumpUrl } from '../util/link.ts';
import { normalizeName } from '../util/string.ts';
import { useIsAdmin } from './auth.ts';
import { useCafeIdsOnPage } from './cafes-on-page.ts';
import { useValueNotifier, useValueNotifierContext } from './events.ts';

interface IReviewCardEditing {
    isEditing: boolean;
    startEditing: () => void;
    stopEditing: () => void;
}

interface IReviewCardActions {
    canModify: boolean;
    isDeletePending: boolean;
    onDeleteClicked: (event: React.MouseEvent) => void;
    onEditClicked: (event: React.MouseEvent) => void;
}

interface IReviewCardViewDisplay {
    hasView: boolean;
    viewName?: string;
}

export const getReviewLookup = (review: IReview): IReviewLookup => {
    if (review.stationId) {
        return { stationId: review.stationId, stationName: review.stationName ?? '' };
    }

    return { menuItemId: review.menuItemId ?? '', menuItemName: review.menuItemName ?? '' };
};

export const getReviewedEntityName = (review: IReview): string | undefined => {
    return review.menuItemName ?? review.stationName;
};

export const getReviewCreatedDateDisplay = (review: IReview): string => {
    return fromDateString(review.createdDate).toLocaleDateString();
};

export const useReviewCardEditing = (): IReviewCardEditing => {
    const [isEditing, setIsEditing] = useState(false);

    return {
        isEditing,
        startEditing: () => setIsEditing(true),
        stopEditing:  () => setIsEditing(false),
    };
};

export const useReviewView = (review: IReview) => {
    const { viewsById } = useContext(ApplicationContext);

    return viewsById.get(review.cafeId);
};

export const useReviewCardViewDisplay = (review: IReview): IReviewCardViewDisplay => {
    const view = useReviewView(review);

    return {
        hasView:  view != null,
        viewName: view == null ? undefined : getViewName({ view, showGroupName: true }),
    };
};

export const useIsReviewMine = (review: IReview): boolean => {
    const userId = useValueNotifierContext(UserContext)?.id;

    return userId != null && userId === review.userId;
};

export const useIsReviewStationReview = (review: IReview): boolean => {
    return isStationReview(getReviewLookup(review));
};

export const useIsReviewCardVisible = (
    review: IReview,
    showMyself: boolean,
    isSkeleton: boolean,
): boolean => {
    const view = useReviewView(review);
    const isMe = useIsReviewMine(review);

    return (isSkeleton || view != null) && (!isMe || showMyself);
};

export const useReviewCardLink = (review: IReview): string => {
    const cafeIdsOnPage = useCafeIdsOnPage();
    const view = useReviewView(review);

    if (view == null) {
        return '#';
    }

    const lookup = getReviewLookup(review);

    return getSearchAnchorJumpUrl({
        cafeId:     review.cafeId,
        entityType: isStationReview(lookup) ? SearchEntityType.station : SearchEntityType.menuItem,
        name:       normalizeName(getReviewEntityName(lookup)),
        view,
        cafeIdsOnPage,
        date:       new Date(),
    });
};

export const useCanModifyReview = (review: IReview): boolean => {
    const isMe = useIsReviewMine(review);
    const isAdmin = useIsAdmin();
    const showAdminControls = useValueNotifier(DebugSettings.showAdminReviewControls);

    return isMe || (isAdmin && showAdminControls);
};

export const useReviewCardActions = (review: IReview, onEdit: () => void): IReviewCardActions => {
    const canModify = useCanModifyReview(review);
    const deleteMutation = useDeleteReview();
    const lookup = getReviewLookup(review);

    const onDeleteClicked = (event: React.MouseEvent) => {
        event.preventDefault();

        if (deleteMutation.isPending) {
            return;
        }

        deleteMutation.mutate(
            { reviewId: review.id, lookup },
            { onError: (err) => console.error('failed to delete:', err) },
        );
    };

    const onEditClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        onEdit();
    };

    return {
        canModify,
        isDeletePending: deleteMutation.isPending,
        onDeleteClicked,
        onEditClicked,
    };
};
