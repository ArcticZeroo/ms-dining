import React from 'react';
import { usePostReviewInput } from '../../hooks/post-review-input.ts';
import type { IPostReviewInputProps } from '../../hooks/post-review-input.ts';
import { PostReviewActions } from './post-review-actions.tsx';
import { PostReviewFields } from './post-review-fields.tsx';
import { PostReviewOptions } from './post-review-options.tsx';

export const PostReviewInput: React.FC<IPostReviewInputProps> = (props) => {
    const reviewInput = usePostReviewInput(props);

    return (
        <div className="flex-col align-center default-container bg-raised-4">
            <div className="flex">
                Leave a review! Comments are optional.
            </div>
            <PostReviewOptions reviewInput={reviewInput}/>
            <PostReviewFields reviewInput={reviewInput}/>
            <PostReviewActions reviewInput={reviewInput}/>
        </div>
    );
};