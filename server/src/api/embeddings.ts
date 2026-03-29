import { IMenuItemBase } from '@msdining/common/models/cafe';
import OpenAI from 'openai';
import { getOpenAiKey } from '../constants/env.js';
import { CafeGroup, ICafe, ICafeStation } from '../models/cafe.js';
import { lazy } from '../util/lazy.js';
import { rethrowWithoutStatus } from '../util/error.js';

const getClient = lazy(() => new OpenAI({
    apiKey: getOpenAiKey()
}));

export const retrieveEmbeddings = async (text: string) => {
    const response = await getClient().embeddings.create({
        model: 'text-embedding-3-small',
        input: text
    }).catch(rethrowWithoutStatus);

    const data = response.data[0];
    if (!data) {
        throw new Error('AI did not return embeddings');
    }

    return data.embedding;
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

export const retrieveStationEmbeddings = async (station: ICafeStation) => {
    const categoryStrings: string[] = [];
    for (const [categoryName, menuItemIds] of station.menuItemIdsByCategoryName.entries()) {
        const categoryStringParts = [`- Category Name: ${categoryName} [`];
        for (const menuItemId of menuItemIds) {
            const menuItem = station.menuItemsById.get(menuItemId);
            if (menuItem) {
                categoryStringParts.push(`-- { ${serializeMenuItemForEmbeddings(menuItem)} }`);
            }
        }
        categoryStringParts.push(']');
        categoryStrings.push(categoryStringParts.join('\n'));
    }

    return retrieveEmbeddings(`
        Station Name: ${station.name}
        Station Categories: ${categoryStrings.join('\n')}
    `);
}

export const retrieveCafeEmbeddings = async (cafe: ICafe, group?: CafeGroup) => {
    const parts = [`Cafe Name: ${cafe.name}`, `Cafe ID: ${cafe.id}`];

    if (cafe.shortName) {
        parts.push(`Cafe Short Name: ${cafe.shortName}`);
    }

    if (group) {
        parts.push(`Cafe Group: ${group.name}`);

        if (group.shortName) {
            parts.push(`Cafe Group Short Name: ${group.shortName}`);
        }

        for (const member of group.members) {
            if (member.id === cafe.id) {
                continue; // Skip the current cafe
            }

            parts.push(`Cafe Group Member: ${member.name} (${member.id})`);
        }
    }

    if (cafe.emoji) {
        parts.push(`Cafe Type Indicator: ${cafe.emoji}`);
    }

    return retrieveEmbeddings(parts.join('\n'));
}
