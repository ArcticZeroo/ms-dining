import { Response } from 'node-fetch';

export const validateSuccessResponse = (response: Response) => {
    if (!response.ok) {
        throw new Error(`Response failed with status: ${response.status}`);
    }
};