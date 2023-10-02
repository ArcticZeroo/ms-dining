import fetch from 'node-fetch';
import ExifReader from 'exifreader';
import { runPromiseWithRetries } from '../../../util/async.js';

const loadImageRetries = 2;

interface IImageData {
    data: ArrayBuffer;
    tags: ExifReader.Tags;
}

export const loadImageData = async (url: string): Promise<IImageData> => {
    const response = await runPromiseWithRetries(() => fetch(url), loadImageRetries);

    if (!response.ok) {
        throw new Error(`Response failed with status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const tags = ExifReader.load(buffer);

    return {
        data: buffer,
        tags
    };
}

export const getRotationDegreesClockwise = (tags: ExifReader.Tags): number => {
    const orientationTag = tags.Orientation;

    console.log('Orientation tag: ', orientationTag);

    if (!orientationTag) {
        return 0;
    }

    const orientation = orientationTag.value;
    switch (orientation) {
        case 1:
            return 0;
        case 3:
            return 180;
        // 6 and 8 are flipped because the dining website is stupid and this is the only way to get the right orientation.
        case 6:
            return 90;
        case 8:
            return 270;
        default:
            console.error(`Unknown orientation: ${orientation}`);
            return 0;
    }
}