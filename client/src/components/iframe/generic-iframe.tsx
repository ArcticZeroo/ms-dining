import React, { useCallback, useEffect, useRef, useState } from 'react';

interface IGenericIFrameProps {
    src: string;
    title: string;
    sandbox: string;
    isVisible?: boolean;
    loadTimeoutMs?: number;
    onMessage?: (event: MessageEvent) => void;
    onLoadTimeout?: () => void;
    onLoadComplete?: () => void;
    onError?: () => void;
}

const useLoadHandler = (loadTimeoutMs: number | undefined, onLoadTimeout: (() => void) | undefined, onLoadComplete: (() => void) | undefined) => {
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [hasFinishedLoading, setHasFinishedLoading] = useState(false);
    const [hasTimedOut, setHasTimedOut] = useState(false);

    const clearLoadTimeout = useCallback(() => {
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (!loadTimeoutMs || hasFinishedLoading || hasTimedOut) {
            return;
        }

        loadTimeoutRef.current = setTimeout(() => {
            setHasTimedOut(true);
            onLoadTimeout?.();
        }, loadTimeoutMs);

        return () => clearLoadTimeout();
    }, [clearLoadTimeout, hasFinishedLoading, hasTimedOut, loadTimeoutMs, onLoadTimeout]);

    const onFrameLoad = useCallback(() => {
        clearLoadTimeout();
        setHasFinishedLoading(true);
        onLoadComplete?.();
    }, [clearLoadTimeout, onLoadComplete]);
    
    return {
        onFrameLoad,
        clearLoadTimeout,
        hasFinishedLoading,
        hasTimedOut
    }
}

export const GenericIFrame: React.FC<IGenericIFrameProps> = ({ src, title, sandbox, isVisible = true, onMessage, loadTimeoutMs, onLoadTimeout, onLoadComplete, onError }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { onFrameLoad, hasTimedOut, clearLoadTimeout } = useLoadHandler(loadTimeoutMs, onLoadTimeout, onLoadComplete);

    useEffect(() => {
        if (!onMessage) {
            return;
        }

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [onMessage]);

    const onFrameError = useCallback(() => {
        clearLoadTimeout();
        onError?.();
    }, [clearLoadTimeout, onError]);
    
    if (hasTimedOut) {
        return null;
    }

    return (
        <iframe
            ref={iframeRef}
            src={src}
            onLoad={onFrameLoad}
            onError={onFrameError}
            title={title}
            sandbox={sandbox}
            style={{ display: isVisible ? undefined : 'none' }}
        />
    );
}