import React, { useCallback, useRef, useState } from 'react';
import { classNames } from '../../util/react.ts';
import starGold from '../../assets/icons/filled/star-gold.svg';
import starOutline from '../../assets/icons/outline/star.svg';
import './star-rating.css';

const STAR_COUNT = 5;

type StarFill = 'full' | 'half' | 'empty';

interface IStarRatingProps {
    value: number;
    readOnly?: boolean;
    disabled?: boolean;
    size?: 'default' | 'large';
    onChange?: (value: number | null) => void;
}

const getStarFill = (starIndex: number, value: number): StarFill => {
    if (value >= starIndex + 1) {
        return 'full';
    }

    if (value >= starIndex + 0.5) {
        return 'half';
    }

    return 'empty';
};

const getValueFromPosition = (containerElement: HTMLElement, clientX: number): number | null => {
    const starCells = containerElement.querySelectorAll('.star-cell');

    for (let starIndex = 0; starIndex < starCells.length; starIndex++) {
        const starCell = starCells[starIndex];

        if (starCell == null) {
            continue;
        }

        const rect = starCell.getBoundingClientRect();

        if (clientX >= rect.left && clientX <= rect.right) {
            const isLeftHalf = (clientX - rect.left) < rect.width / 2;
            return isLeftHalf ? starIndex + 0.5 : starIndex + 1;
        }
    }

    return null;
};

export const StarRating: React.FC<IStarRatingProps> = ({
    value,
    readOnly = false,
    disabled = false,
    size = 'default',
    onChange,
}) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const [hoverValue, setHoverValue] = useState<number | null>(null);
    const isInteractive = !readOnly && onChange != null;
    const displayValue = (isInteractive && !disabled && hoverValue != null) ? hoverValue : value;

    const onStarClick = (event: React.MouseEvent<HTMLSpanElement>, starIndex: number) => {
        if (!isInteractive || disabled) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const isLeftHalf = clickX < rect.width / 2;
        const newValue = isLeftHalf ? starIndex + 0.5 : starIndex + 1;

        onChange(newValue === value ? null : newValue);
    };

    const onStarMouseMove = (event: React.MouseEvent<HTMLSpanElement>, starIndex: number) => {
        if (!isInteractive || disabled) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const isLeftHalf = mouseX < rect.width / 2;
        setHoverValue(isLeftHalf ? starIndex + 0.5 : starIndex + 1);
    };

    const onMouseLeave = () => {
        if (isInteractive) {
            setHoverValue(null);
        }
    };

    const onTouchMove = useCallback((event: React.TouchEvent) => {
        if (!isInteractive || disabled || containerRef.current == null) {
            return;
        }

        event.preventDefault();
        const touch = event.touches[0];

        if (touch == null) {
            return;
        }

        const touchValue = getValueFromPosition(containerRef.current, touch.clientX);

        if (touchValue != null) {
            setHoverValue(touchValue);
        }
    }, [isInteractive, disabled]);

    const onTouchEnd = useCallback(() => {
        if (!isInteractive || disabled) {
            return;
        }

        if (hoverValue != null) {
            onChange(hoverValue === value ? null : hoverValue);
        }

        setHoverValue(null);
    }, [isInteractive, disabled, hoverValue, value, onChange]);

    const containerClass = classNames(
        'star-rating',
        size === 'large' && 'large',
        isInteractive && 'interactive',
        disabled && 'disabled',
    );

    return (
        <span
            ref={containerRef}
            className={containerClass}
            role={isInteractive ? 'slider' : 'img'}
            aria-label={`${value} out of ${STAR_COUNT} stars`}
            aria-valuenow={isInteractive ? value : undefined}
            aria-valuemin={isInteractive ? 0 : undefined}
            aria-valuemax={isInteractive ? STAR_COUNT : undefined}
            onMouseLeave={onMouseLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {Array.from({ length: STAR_COUNT }, (_, index) => {
                const fill = getStarFill(index, displayValue);

                return (
                    <span
                        key={index}
                        className="star-cell"
                        onClick={(event) => onStarClick(event, index)}
                        onMouseMove={(event) => onStarMouseMove(event, index)}
                    >
                        <span className="star-icon-wrapper">
                            <img className="star-icon star-empty" src={starOutline} alt="star icon" />
                            {fill !== 'empty' && (
                                <img
                                    className={classNames('star-icon star-filled', fill === 'half' && 'star-half')}
                                    src={starGold}
                                    alt="star icon"
                                />
                            )}
                        </span>
                    </span>
                );
            })}
        </span>
    );
};
