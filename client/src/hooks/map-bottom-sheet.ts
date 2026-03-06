import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceType, useDeviceType } from './media-query.ts';

const SNAP_POINTS: readonly [number, number, number] = [0.3, 0.5, 0.95] as const;
const DEFAULT_SNAP = SNAP_POINTS[1];
const MIN_SNAP = SNAP_POINTS[0];

const findNearestSnap = (fraction: number): number => {
    let nearest = SNAP_POINTS[0];
    let minDist = Math.abs(fraction - nearest);
    for (const snap of SNAP_POINTS) {
        const dist = Math.abs(fraction - snap);
        if (dist < minDist) {
            minDist = dist;
            nearest = snap;
        }
    }
    return nearest;
};

export const useBottomSheetDrag = () => {
    const deviceType = useDeviceType();
    const isMobile = deviceType === DeviceType.Mobile;

    const handleRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [heightFraction, setHeightFraction] = useState(DEFAULT_SNAP);
    const [isDragging, setIsDragging] = useState(false);
    const [showHandle, setShowHandle] = useState(false);

    const heightRef = useRef(DEFAULT_SNAP);
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ y: 0, fraction: DEFAULT_SNAP });

    const checkIfHandleNeeded = useCallback(() => {
        const panel = panelRef.current;
        if (!panel || !isMobile) {
            setShowHandle(false);
            return;
        }

        const container = panel.closest('.map-page');
        if (!container) {
            setShowHandle(false);
            return;
        }

        const minSnapHeight = container.clientHeight * MIN_SNAP;
        // Temporarily remove constraints so scrollHeight reflects full content
        const prevOverflow = panel.style.overflow;
        const prevMaxHeight = panel.style.maxHeight;
        panel.style.overflow = 'auto';
        panel.style.maxHeight = 'none';
        const contentHeight = panel.scrollHeight;
        panel.style.overflow = prevOverflow;
        panel.style.maxHeight = prevMaxHeight;
        setShowHandle(contentHeight > minSnapHeight);
    }, [isMobile]);

    useEffect(() => {
        checkIfHandleNeeded();

        const panel = panelRef.current;
        if (!panel) {
            return;
        }

        // Observe children rather than the panel itself, so drag-driven
        // max-height changes don't trigger re-checks.
        const observer = new ResizeObserver(checkIfHandleNeeded);
        for (const child of panel.children) {
            observer.observe(child);
        }

        return () => observer.disconnect();
    }, [checkIfHandleNeeded]);

    useEffect(() => {
        if (!isMobile) {
            return;
        }

        const handle = handleRef.current;
        if (!handle) {
            return;
        }

        const onPointerDown = (e: PointerEvent) => {
            isDraggingRef.current = true;
            dragStartRef.current = { y: e.clientY, fraction: heightRef.current };
            handle.setPointerCapture(e.pointerId);
            setIsDragging(true);
            e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDraggingRef.current) {
                return;
            }

            const dy = dragStartRef.current.y - e.clientY;
            const containerHeight = handle.closest('.map-page')?.clientHeight ?? window.innerHeight;
            const deltaFraction = dy / containerHeight;
            const newFraction = Math.max(0.15, Math.min(0.95, dragStartRef.current.fraction + deltaFraction));
            heightRef.current = newFraction;
            setHeightFraction(newFraction);
        };

        const onPointerUp = () => {
            if (!isDraggingRef.current) {
                return;
            }

            isDraggingRef.current = false;
            setIsDragging(false);
            const snapped = findNearestSnap(heightRef.current);
            heightRef.current = snapped;
            setHeightFraction(snapped);
        };

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        return () => {
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
        };
    }, [isMobile]);

    const sheetStyle = isMobile
        ? {
            maxHeight:  `${heightFraction * 100}%`,
            transition: isDragging ? 'none' : 'max-height 0.2s ease',
        }
        : {};

    return { handleRef, panelRef, sheetStyle, isMobile, showHandle };
};
