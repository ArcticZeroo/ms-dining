import React, { ImgHTMLAttributes, useEffect, useRef, useState } from 'react';
import { scaleImage } from '../../util/image.ts';

interface IDownscaledImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    maxHeight?: number;
    maxWidth?: number;
}

export const DownscaledImage: React.FC<IDownscaledImageProps> = ({
    src,
    alt,
    className,
    maxHeight,
    maxWidth,
    ...imageProps
}) => {
    const [imageData, setImageData] = useState<string>('');
    const imageLoadSymbolRef = useRef<symbol | null>(null);

    useEffect(() => {
        const currentSymbol = Symbol();
        imageLoadSymbolRef.current = currentSymbol;

        setImageData('');

        const image = new Image();

        image.crossOrigin = 'anonymous';
        image.src = src;

        image.decode()
            .then(() => {
                // We started loading another image after this one began loading
                if (imageLoadSymbolRef.current !== currentSymbol) {
                    return;
                }

                setImageData(scaleImage(image, maxWidth, maxHeight));
            })
            .catch(err => console.error('Could not decode image:', err));
    }, [src, maxWidth, maxHeight]);

    return (
        <img
            decoding="async"
            src={imageData}
            alt={alt}
            className={className}
            {...imageProps}
        />
    );
};