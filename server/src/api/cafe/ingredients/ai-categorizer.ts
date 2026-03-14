import { z } from 'zod';
import { ICafeStation } from '../../../models/cafe.js';
import { retrieveTextCompletion } from '../../ai/index.js';
import { getNamespaceLogger } from '../../../util/log.js';
import { IMenuRoleRow } from './cache.js';

const logger = getNamespaceLogger('ingredients-ai');

const aiResponseSchema = z.object({
    price:    z.number(),
    starters: z.array(z.string()),
    entrees:  z.array(z.string()),
    desserts: z.array(z.string()),
    drinks:   z.array(z.string()).default([]),
    sides:    z.array(z.string()).default([]),
    other:    z.array(z.string()).default([]),
});

const serializeStationForPrompt = (station: ICafeStation): string => {
    const lines: string[] = [];

    for (const [categoryName, itemIds] of station.menuItemIdsByCategoryName) {
        lines.push(`\n## Category: "${categoryName}"`);

        for (const itemId of itemIds) {
            const item = station.menuItemsById.get(itemId);
            if (!item) {
                continue;
            }

            const parts = [`  - Item ID: "${item.id}" | Name: "${item.name}" | Price: $${item.price.toFixed(2)}`];
            if (item.description) {
                parts.push(`    Description: "${item.description}"`);
            }
            if (item.modifiers.length > 0) {
                parts.push(`    Modifiers:`);
                for (const modifier of item.modifiers) {
                    const choiceNames = modifier.choices.map(choice => `"${choice.description}"`).join(', ');
                    parts.push(`      - ${modifier.description}: [${choiceNames}]`);
                }
            }
            lines.push(parts.join('\n'));
        }
    }

    return lines.join('\n');
};

const buildPrompt = (stations: ICafeStation[]): string => {
    const menuData = stations.map(serializeStationForPrompt).join('\n');

    return `You are an expert at analyzing restaurant menus. You need to categorize menu items for "in.gredients", a prix fixe 3-course meal restaurant.

[CONTEXT]
in.gredients offers a fixed-price 3-course dinner: diners choose 1 starter + 1 entrée + 1 dessert for one set price.
The menu data comes from a "buy-on-demand" ordering system where:
- A "3 Course Meal" category contains the ENTRÉES. Each entrée may have modifiers like "Starter Choice" or "Dessert Choice" listing the available starter/dessert options.
- An "À la carte Menu" category lists individual items available for separate purchase, including à la carte versions of the 3-course items.
- An "Additional Offerings" category has sides, drinks, and extras not part of the 3-course meal.

Key things to know:
- Items in the "3 Course Meal" category are ENTRÉES.
- Modifier choices named "Starter Choice" or similar contain the STARTER options. Modifier choices named "Dessert Choice" or similar contain the DESSERT options.
- IMPORTANT: When an item appears in BOTH the "3 Course Meal" category AND the "À la carte Menu" category, use the À LA CARTE version's Item ID. The à la carte version shows the individual price which is more useful for display. The 3-course version's ID should be excluded.
- The 3-course meal price is the price of any entrée in the "3 Course Meal" category.
- Desserts sometimes have creative names like "Sweet" or "Savory" with the actual dessert described in the description field.
- DRINK items are beverages like mocktails, wines, coffees.
- SIDE items are non-course items like bread, soup, additional sides.
- OTHER is anything that doesn't fit the above categories.

[EXAMPLE]
Given a menu with:
- "3 Course Meal" category: "Vegan Lasagna" (ID: 3cm-vl, $25, modifiers: Starter Choice [Five Onion Soup, Ahi Tuna], Dessert Choice [Chocolate Cake, Cheese Plate]), "Steak Frites*" (ID: 3cm-sf, $25)
- "À la carte Menu": "Five Onion Soup" (ID: alc-fos, $6.50), "Ahi Tuna" (ID: alc-at, $6.50), "Vegan Lasagna - À la carte" (ID: alc-vl, $18), "Steak Frites* - À la carte" (ID: alc-sf, $18), "Sweet" (ID: alc-sweet, $6.50, desc: Flourless Chocolate Cake...), "Savory" (ID: alc-savory, $6.50, desc: Cheese Plate...)
- "Additional Offerings": "Bread Basket" (ID: ao-bb, $4.75), "Mocktail" (ID: ao-mock, $5.75)

Correct categorization (note: à la carte IDs used for entrées, starters, and desserts):
price: 25
STARTER: alc-fos, alc-at
ENTREE: alc-vl, alc-sf (à la carte versions, NOT the 3-course IDs)
DESSERT: alc-sweet, alc-savory
DRINK: ao-mock
SIDE: ao-bb
OTHER: (none)

[MENU DATA]
${menuData}

[INSTRUCTIONS]
Analyze the menu data above and categorize items into: STARTER, ENTREE, DESSERT, DRINK, SIDE, OTHER.
- Identify the 3-course meal price from the "3 Course Meal" category entrée prices. This will be higher than the price of any individual item in the à la carte menu, including entrees.
- For starters, desserts, and entrées: use the À LA CARTE version's Item ID when available (the one with individual pricing). Exclude the 3-course version.
- Use the modifier choice names to identify which à la carte items are starters vs desserts.

Respond with your analysis inside XML tags. You may include reasoning before the tags, but the tags must contain valid JSON:
<menu-analysis>
{
  "price": <number>,
  "starters": ["<item_id>", ...],
  "entrees": ["<item_id>", ...],
  "desserts": ["<item_id>", ...],
  "drinks": ["<item_id>", ...],
  "sides": ["<item_id>", ...],
  "other": ["<item_id>", ...]
}
</menu-analysis>`;
};

const parseAiResponse = (response: string): z.infer<typeof aiResponseSchema> | null => {
    const xmlMatch = response.match(/<menu-analysis>([\s\S]*?)<\/menu-analysis>/);
    if (!xmlMatch) {
        // Fallback: try extracting raw JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            logger.error('AI response did not contain <menu-analysis> tags or JSON');
            return null;
        }
        return parseJsonWithZod(jsonMatch[0]);
    }

    return parseJsonWithZod(xmlMatch[1]!);
};

const parseJsonWithZod = (jsonString: string): z.infer<typeof aiResponseSchema> | null => {
    try {
        const parsed = JSON.parse(jsonString);
        const result = aiResponseSchema.safeParse(parsed);
        if (!result.success) {
            logger.error('AI response JSON failed validation:', result.error.message);
            return null;
        }
        return result.data;
    } catch (err) {
        logger.error('Failed to parse AI response JSON:', err);
        return null;
    }
};

const categoriesToRoles = (categorized: z.infer<typeof aiResponseSchema>): IMenuRoleRow[] => {
    const roles: IMenuRoleRow[] = [];
    const addRoles = (ids: string[], role: string) => {
        for (const menuItemId of ids) {
            roles.push({ menuItemId, role });
        }
    };
    addRoles(categorized.starters, 'STARTER');
    addRoles(categorized.entrees, 'ENTREE');
    addRoles(categorized.desserts, 'DESSERT');
    addRoles(categorized.drinks, 'DRINK');
    addRoles(categorized.sides, 'SIDE');
    addRoles(categorized.other, 'OTHER');
    return roles;
};

export const categorizeIngredientsMenu = async (stations: ICafeStation[]): Promise<{ price: number; roles: IMenuRoleRow[] } | null> => {
    if (stations.length === 0) {
        return null;
    }

    logger.info('Running AI categorization...');

    const prompt = buildPrompt(stations);

    try {
        const response = await retrieveTextCompletion({
            systemPrompt: 'You are a menu categorization expert.',
            userMessage:  prompt,
        });

        const parsed = parseAiResponse(response);
        if (!parsed) {
            logger.error('Failed to parse AI response');
            return null;
        }

        const roles = categoriesToRoles(parsed);

        if (parsed.entrees.length === 0 || parsed.starters.length === 0 || parsed.desserts.length === 0) {
            logger.error('AI categorization returned too few items in a category, discarding result');
            return null;
        }

        logger.info(`Successfully categorized ingredients menu (${parsed.entrees.length} entrées, ${parsed.starters.length} starters, ${parsed.desserts.length} desserts, ${parsed.drinks.length} drinks, ${parsed.sides.length} sides, ${parsed.other.length} other)`);
        return { price: parsed.price, roles };
    } catch (err) {
        logger.error('AI categorization failed:', err);
        return null;
    }
};
