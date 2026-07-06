import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { Link } from 'react-router-dom';
import { useIsReviewMine, useReviewCardLink } from '../../hooks/review-card.ts';
import { classNames } from '../../util/react.ts';

interface IReviewCardShellProps {
    review: IReview;
    stretchSelf?: boolean;
    children: React.ReactNode;
}

export const ReviewCardShell: React.FC<IReviewCardShellProps> = ({
    review,
    stretchSelf = false,
    children
}) => {
    const link = useReviewCardLink(review);
    const isMe = useIsReviewMine(review);

    return (
        <Link
            to={link}
            className={classNames('flex-col card no-decoration', isMe && 'dark-blue', stretchSelf && 'self-stretch')}
        >
            {children}
        </Link>
    );
};
