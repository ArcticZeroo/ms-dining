import React, { useCallback, useEffect, useRef } from 'react';

interface IGenericIFrameProps {
    src: string;
    title: string;
    sandbox: string;
    loadTimeoutMs?: number;
    onMessage?: (event: MessageEvent) => void;
    onLoadTimeout?: () => void;
    onLoadComplete?: () => void;
    onError?: () => void;
}

export const GenericIFrame: React.FC<IGenericIFrameProps> = ({ src, title, sandbox, onMessage, loadTimeoutMs, onLoadTimeout, onLoadComplete, onError }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const clearLoadTimeout = useCallback(() => {
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (!onMessage) {
            return;
        }
        
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [onMessage]);

    useEffect(() => {
        if (!loadTimeoutMs) {
            return;
        }

        loadTimeoutRef.current = setTimeout(() => {
            onLoadTimeout?.();
        }, loadTimeoutMs);

        return () => clearLoadTimeout();
    }, [loadTimeoutMs, onLoadTimeout, clearLoadTimeout]);

    const onFrameLoad = useCallback(() => {
        clearLoadTimeout();
        onLoadComplete?.();
    }, [clearLoadTimeout, onLoadComplete]);

    const onFrameError = useCallback(() => {
        clearLoadTimeout();
        onError?.();
    }, [clearLoadTimeout, onError]);

    return (
        <iframe
            ref={iframeRef}
            src={src}
            onLoad={onFrameLoad}
            onError={onFrameError}
            title={title}
            sandbox={sandbox}
        />
    );
}