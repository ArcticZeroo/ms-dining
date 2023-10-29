import { ICafe, ICafeConfig } from '../models/cafe.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../constants/cafes.js';

export const getLogoUrl = (cafe: ICafe, config?: ICafeConfig) => {
    if (!config || !config.logoName) {
        return undefined;
    }

    return `${getBaseApiUrlWithoutTrailingSlash(cafe)}/image/${config.tenantId}/${config.contextId}/${config.logoName}`;
}