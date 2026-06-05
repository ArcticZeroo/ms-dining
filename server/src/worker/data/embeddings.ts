import { IMenuItemBase } from '@msdining/common/models/cafe';
import { rethrowWithoutStatus } from '../../shared/util/error.js';
import { retrieveEmbedding as retrieveEmbeddingFromAi } from '../../shared/ai/index.js';

export const retrieveEmbeddings = async (text: string) => {
    return retrieveEmbeddingFromAi(text).catch(rethrowWithoutStatus);
}

const serializeMenuItemForEmbeddings = (menuItem: IMenuItemBase): string => {
    const parts = [
        `Menu Item Name: ${menuItem.name}`,
    ];

    if (menuItem.description) {
        parts.push(`Menu Item Description: ${menuItem.description}`);
    }

    if (menuItem.modifiers.length > 0) {
        parts.push(`Menu Item Modifiers:`);
        for (const modifier of menuItem.modifiers) {
            parts.push(`- ${modifier.description} [${modifier.choices.map(choice => choice.description).join(', ')}]`);
        }
    }

    if (menuItem.tags.size > 0) {
        parts.push(`Menu Item Tags: ${Array.from(menuItem.tags).join(', ')}`);
    }

    if (menuItem.searchTags.size > 0) {
        parts.push(`Menu Item Search Tags: ${Array.from(menuItem.searchTags).join(', ')}`);
    }

    return parts.join('\n');
};

export const retrieveMenuItemEmbeddings = async (menuItem: IMenuItemBase, categoryName: string, stationName: string) => {
    return retrieveEmbeddings(
        `
        Station Name: ${stationName}
        Category Name: ${categoryName}
        ${serializeMenuItemForEmbeddings(menuItem)}
    `);
}
