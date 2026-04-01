import React, { JSX, useEffect, useMemo, useRef, useState } from 'react';
import { classNames } from '../../util/react.js';
import { DeviceType, useDeviceType } from '../../hooks/media-query.js';

export interface ITabOption {
    name: string;
    id: string;
}

export interface ITabViewProps {
    options: ITabOption[];
    selectedTabId: string;
    onTabIdChanged(tabId: string): void;
    renderTab: (tabId: string) => JSX.Element;
    loadingTabCount?: number;
    enableSwipe?: boolean;
}

const MIN_SWIPE_DISTANCE_PX = 80;
const VELOCITY_SWIPE_DISTANCE_PX = 30;
const SWIPE_VELOCITY_THRESHOLD = 0.5; // px/ms

const useTabSwipe = (
    container: HTMLDivElement | null,
    options: ITabOption[],
    selectedTabId: string,
    onTabIdChanged: (tabId: string) => void,
    enabled: boolean
) => {
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const dragRef = useRef({ startX: 0, startY: 0, decided: false, isHorizontal: false, isSwipe: false });
    const lastMoveRef = useRef({ x: 0, time: 0 });
    const prevMoveRef = useRef({ x: 0, time: 0 });

    const [previousTab, nextTab] = useMemo(() => {
        const currentIndex = options.findIndex(option => option.id === selectedTabId);
        return [options[currentIndex - 1]?.id ?? null, options[currentIndex + 1]?.id ?? null];
    }, [options, selectedTabId]);

    const swipeStateRef = useRef({ previousTab, nextTab, onTabIdChanged });
    swipeStateRef.current = { previousTab, nextTab, onTabIdChanged };

    useEffect(() => {
        if (!container || !enabled) {
            return;
        }

        // Check if an element between target and container can scroll horizontally in the given direction
        const isAtScrollEdge = (target: EventTarget | null, swipeDirection: number): boolean => {
            let element = target as HTMLElement | null;
            while (element && element !== container) {
                if (element.scrollWidth > element.clientWidth) {
                    if (swipeDirection < 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1) {
                        return false;
                    }
                    if (swipeDirection > 0 && element.scrollLeft > 1) {
                        return false;
                    }
                }
                element = element.parentElement;
            }
            return true;
        };

        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) {
                return;
            }

            dragRef.current = { startX: touch.clientX, startY: touch.clientY, decided: false, isHorizontal: false, isSwipe: false };
            lastMoveRef.current = { x: touch.clientX, time: Date.now() };
            prevMoveRef.current = lastMoveRef.current;
        };

        const onTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) {
                return;
            }

            const dx = touch.clientX - dragRef.current.startX;
            const dy = touch.clientY - dragRef.current.startY;

            if (!dragRef.current.decided) {
                // Wait until we have enough movement to decide direction
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                    return;
                }

                dragRef.current.decided = true;
                dragRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);

                // If horizontal, check if inner content can still scroll before claiming it as a tab swipe
                if (dragRef.current.isHorizontal) {
                    dragRef.current.isSwipe = isAtScrollEdge(event.target, dx);
                }
            }

            if (!dragRef.current.isSwipe) {
                return;
            }

            // Only drag if there's somewhere to go
            if (!swipeStateRef.current.previousTab && !swipeStateRef.current.nextTab) {
                return;
            }

            event.preventDefault();
            setIsDragging(true);
            setDragOffsetX(dx);

            prevMoveRef.current = lastMoveRef.current;
            lastMoveRef.current = { x: touch.clientX, time: Date.now() };
        };

        const onTouchEnd = () => {
            if (!dragRef.current.isSwipe) {
                dragRef.current = { startX: 0, startY: 0, decided: false, isHorizontal: false, isSwipe: false };
                return;
            }

            const dx = lastMoveRef.current.x - dragRef.current.startX;
            const dt = lastMoveRef.current.time - prevMoveRef.current.time;
            const velocity = dt > 0 ? Math.abs(lastMoveRef.current.x - prevMoveRef.current.x) / dt : 0;

            // Swipe left (negative dx) → next tab, swipe right (positive dx) → previous tab
            const absDx = Math.abs(dx);
            const hasSufficientDistance = absDx > MIN_SWIPE_DISTANCE_PX;
            const hasFling = absDx > VELOCITY_SWIPE_DISTANCE_PX && velocity > SWIPE_VELOCITY_THRESHOLD;

            if (hasSufficientDistance || hasFling) {
                const nextTabId = dx < 0 ? swipeStateRef.current.nextTab : swipeStateRef.current.previousTab;
                if (nextTabId) {
                    swipeStateRef.current.onTabIdChanged(nextTabId);
                }
            }

            setDragOffsetX(0);
            setIsDragging(false);
            dragRef.current = { startX: 0, startY: 0, decided: false, isHorizontal: false, isSwipe: false };
        };

        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd);
        container.addEventListener('touchcancel', onTouchEnd);

        return () => {
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            container.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [container, enabled]);

    return { dragOffsetX, isDragging };
};

export const TabView: React.FC<ITabViewProps> = ({ options, renderTab, selectedTabId, onTabIdChanged, loadingTabCount = 0, enableSwipe = false }) => {
    if (options.length === 0 && loadingTabCount === 0) {
        throw new Error('TabView must have >0 options.');
    }

    const deviceType = useDeviceType();
    const swipeEnabled = enableSwipe && deviceType === DeviceType.Mobile;
    const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);
    const { dragOffsetX, isDragging } = useTabSwipe(contentElement, options, selectedTabId, onTabIdChanged, swipeEnabled);

    const contentStyle = useMemo(() => {
        if (!swipeEnabled) {
            return undefined;
        }

        if (isDragging) {
            return { transform: `translateX(${dragOffsetX}px)`, transition: 'none' };
        }

        return { transform: 'translateX(0)', transition: 'transform 0.2s ease' };
    }, [swipeEnabled, isDragging, dragOffsetX]);

    return (
        <div className="flex-col tab-view">
            <div className="flex flex-wrap tab-selector">
                {
                    options.map((option) => (
                        <button className={classNames('tab-option', option.id === selectedTabId && 'active')} key={option.id} onClick={() => onTabIdChanged(option.id)}>
                            {option.name}
                        </button>
                    ))
                }
                {
                    Array.from({ length: loadingTabCount }, (_, index) => (
                        <button className="tab-option loading-skeleton" key={`loading-${index}`} disabled>
                            ...
                        </button>
                    ))
                }
            </div>
            <div ref={setContentElement} className="tab-content" style={contentStyle}>
                {options.length > 0 && <React.Fragment key={selectedTabId}>{renderTab(selectedTabId)}</React.Fragment>}
            </div>
        </div>
    );
}