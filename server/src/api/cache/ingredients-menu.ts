import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import { ICafeStation } from '../../models/cafe.js';
import { LockedMap } from '../../util/map.js';
import { computeMenuHash, IMenuRoleRow, getIngredientsMenuByHash, setRolesForMenuHash } from '../cafe/ingredients/cache.js';
import { categorizeIngredientsMenu } from '../cafe/ingredients/ai-categorizer.js';
import { CACHE_EVENTS } from '../storage/events.js';
import { logInfo } from '../../util/log.js';

const INGREDIENTS_CAFE_ID = 'in-gredients';

// Cache keyed by dateString — pre-populated on menu publish, so route requests don't re-hash
const INGREDIENTS_MENU_CACHE = new LockedMap<string /*dateString*/, IIngredientsMenuDTO>();

const ROLE_TO_DTO_KEY: Record<string, keyof Pick<IIngredientsMenuDTO, 'starterChoiceIds' | 'entreeChoiceIds' | 'dessertChoiceIds' | 'drinkChoiceIds' | 'sideChoiceIds' | 'otherItemIds'>> = {
    STARTER: 'starterChoiceIds',
    ENTREE:  'entreeChoiceIds',
    DESSERT: 'dessertChoiceIds',
    DRINK:   'drinkChoiceIds',
    SIDE:    'sideChoiceIds',
    OTHER:   'otherItemIds',
};

const buildIngredientsDTO = (roles: IMenuRoleRow[], stations: ICafeStation[], price: number): IIngredientsMenuDTO => {
    const logoUrl = stations[0]?.logoUrl ?? null;

    const dto: IIngredientsMenuDTO = {
        price,
        logoUrl,
        starterChoiceIds: [],
        entreeChoiceIds:  [],
        dessertChoiceIds: [],
        drinkChoiceIds:   [],
        sideChoiceIds:    [],
        otherItemIds:     [],
    };

    for (const { menuItemId, role } of roles) {
        const key = ROLE_TO_DTO_KEY[role];
        if (key) {
            dto[key].push(menuItemId);
        }
    }

    return dto;
};

const categorizeAndCache = async (dateString: string, menuStations: ICafeStation[]): Promise<IIngredientsMenuDTO | undefined> => {
    const hash = computeMenuHash(menuStations);

    const cached = await getIngredientsMenuByHash(hash);
    if (cached != null) {
        return buildIngredientsDTO(cached.roles, menuStations, cached.price);
    }

    const aiResult = await categorizeIngredientsMenu(menuStations);
    if (aiResult == null) {
        return undefined;
    }

    await setRolesForMenuHash(hash, aiResult.roles, aiResult.price);
    return buildIngredientsDTO(aiResult.roles, menuStations, aiResult.price);
};

// Pre-compute on menu publish so route requests are instant
CACHE_EVENTS.on('menuPublished', (event) => {
    if (event.cafe.id !== INGREDIENTS_CAFE_ID) {
        return;
    }

    logInfo(`[IngredientsCache] Menu published for in.gredients on ${event.dateString}, pre-computing...`);

    INGREDIENTS_MENU_CACHE.update(event.dateString, () => categorizeAndCache(event.dateString, event.menu))
        .catch(err => logInfo('[IngredientsCache] Failed to pre-compute ingredients menu:', err));
});

export const resolveIngredientsMenuAsync = async (cafeId: string, dateString: string, menuStations: ICafeStation[]): Promise<IIngredientsMenuDTO | null> => {
    if (cafeId !== INGREDIENTS_CAFE_ID) {
        return null;
    }

    const result = await INGREDIENTS_MENU_CACHE.update(dateString, async (cached) => {
        if (cached != null) {
            return cached;
        }

        // Cold boot or cache miss — compute on demand
        return categorizeAndCache(dateString, menuStations);
    });

    return result ?? null;
};
