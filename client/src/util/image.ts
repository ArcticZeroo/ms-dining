export const scaleImage = (image: HTMLImageElement, maxWidth?: number, maxHeight?: number): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (ctx == null) {
        console.error('Could not create a canvas context while downscaling image:', ctx);
        return '';
    }

    const imageWidthPx = image.naturalWidth;
    const imageHeightPx = image.naturalHeight;

    console.log('Loaded an image with width', imageWidthPx, 'and height', imageHeightPx);
    console.log('target max width', maxWidth, 'and target max height', maxHeight);

    let scale = 1;

    if (maxHeight && imageHeightPx > maxHeight) {
        scale = maxHeight / imageHeightPx;
    }

    if (maxWidth && imageWidthPx > maxWidth) {
        scale = Math.min(scale, maxWidth / imageWidthPx);
    }

    const finalWidthPx = Math.floor(imageWidthPx * scale);
    const finalHeightPx = Math.floor(imageHeightPx * scale);

    canvas.height = finalHeightPx;
    canvas.width = finalWidthPx;
    ctx.drawImage(image, 0, 0, finalWidthPx, finalHeightPx);

    console.log('final canvas size:', finalWidthPx, 'x', finalHeightPx);

    return canvas.toDataURL('image/png');
}