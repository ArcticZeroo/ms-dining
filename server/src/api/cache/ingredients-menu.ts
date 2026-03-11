import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import { ICafeStation } from '../../models/cafe.js';
import { LockedMap } from '../../util/map.js';
import { computeMenuHash, getRolesByMenuHash, setRolesForMenuHash, IMenuRoleRow } from '../cafe/ingredients/cache.js';
import { categorizeIngredientsMenu } from '../cafe/ingredients/ai-categorizer.js';

const INGREDIENTS_MENU_CACHE = new LockedMap<string /*menuHash*/, IIngredientsMenuDTO>();

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

const deriveEntreePrice = (roles: IMenuRoleRow[], stations: ICafeStation[]): number => {
	for (const station of stations) {
		for (const { menuItemId, role } of roles) {
			if (role === 'ENTREE') {
				const item = station.menuItemsById.get(menuItemId);
				if (item) {
					return item.price;
				}
			}
		}
	}
	return 0;
};

export const resolveIngredientsMenuAsync = async (cafeId: string, menuStations: ICafeStation[]): Promise<IIngredientsMenuDTO | null> => {
	if (cafeId !== 'in-gredients') {
		return null;
	}

	const hash = computeMenuHash(menuStations);

	const result = await INGREDIENTS_MENU_CACHE.update(hash, async (cached) => {
		if (cached != null) {
			return cached;
		}

		const roles = await getRolesByMenuHash(hash);
		if (roles.length > 0) {
			const price = deriveEntreePrice(roles, menuStations);
			return buildIngredientsDTO(roles, menuStations, price);
		}

		const aiResult = await categorizeIngredientsMenu(menuStations);
		if (aiResult == null) {
			return undefined;
		}

		await setRolesForMenuHash(hash, aiResult.roles);
		return buildIngredientsDTO(aiResult.roles, menuStations, aiResult.price);
	});

	return result ?? null;
};
