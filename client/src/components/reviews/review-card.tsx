import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { useIsReviewCardVisible, useReviewCardEditing } from '../../hooks/review-card.ts';
import { ReviewEditForm } from './review-edit-form.tsx';
import { ReviewCardActions } from './review-card-actions.tsx';
import { ReviewCardComment } from './review-card-comment.tsx';
import { ReviewCardHeader } from './review-card-header.tsx';
import { ReviewCardMeta } from './review-card-meta.tsx';
import { ReviewCardShell } from './review-card-shell.tsx';
import { ReviewStationBadge } from './review-station-badge.tsx';

interface IReviewCardProps {
    review: IReview;
    isSkeleton?: boolean;
    showName?: boolean;
    showMyself: boolean;
    stretchSelf?: boolean;
    showCommentInline?: boolean;
}

export const ReviewCard: React.FC<IReviewCardProps> = ({
    review,
    showMyself,
    showName = true,
    isSkeleton = false,
    stretchSelf = false,
    showCommentInline = true
}) => {
    const { isEditing, startEditing, stopEditing } = useReviewCardEditing();
    const isVisible = useIsReviewCardVisible(review, showMyself, isSkeleton);

    if (!isVisible) {
        return null;
    }

    if (isEditing) {
        return (
            <ReviewEditForm
                review={review}
                stretchSelf={stretchSelf}
                onSaved={stopEditing}
                onCancelled={stopEditing}
            />
        );
    }

    return (
        <ReviewCardShell review={review} stretchSelf={stretchSelf}>
            <ReviewCardHeader review={review} showName={showName}/>
            <ReviewStationBadge review={review}/>
            <ReviewCardMeta review={review}/>
            <ReviewCardComment review={review} showCommentInline={showCommentInline}/>
            <ReviewCardActions review={review} onEdit={startEditing}/>
        </ReviewCardShell>
    );
};