import { ICafe, ICafeGroup } from '../models/cafe.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ id }: ICafe) => `https://${id}.buy-ondemand.com/api`;

export const groupIds = {
	commons:               'commons',
	localFlavorsBuilding6: 'local-flavors'
};

export const groupList: ICafeGroup[] = [
	{
		name: 'The Commons',
		id:   groupIds.commons
	},
	{
		name: 'Local Flavors @ Building 6',
		id:   groupIds.localFlavorsBuilding6
	}
];

export const cafeList: ICafe[] = [
	{
		name: 'Café 16',
		id:   'cafe16',
	},
	{
		name: 'Café 25',
		id:   'cafe25',
	},
	{
		name: 'Café 31',
		id:   'cafe31',
	},
	{
		name: 'Café 34',
		id:   'cafe34',
	},
	{
		name: 'Café 36',
		id:   'cafe36',
	},
	{
		name: 'Café 37',
		id:   'cafe37',
	},
	{
		name: 'Café 40/41',
		id:   'cafe40-41',
	},
	{
		name: 'Café 43',
		id:   'cafe43',
	},
	{
		name: 'Café 50',
		id:   'cafe50',
	},
	{
		name: 'Café 83',
		id:   'cafe83',
	},
	{
		name: 'Café 86',
		id:   'cafe86',
	},
	{
		name: 'Café 99',
		id:   'cafe99',
	},
	{
		name: 'Café 109',
		id:   'cafe109',
	},
	{
		name: 'Café 112',
		id:   'cafe112',
	},
	{
		name: 'Café 121',
		id:   'cafe121',
	},
	{
		name: 'Café RedWest',
		id:   'caferedwest',
	},
	{
		name: 'Café RTC',
		id:   'cafertc5',
	},
	{
		name: 'Café Studio H',
		id:   'cafestudioh',
	},
	{
		name: 'One Esterra Food Hall',
		id:   'one-esterra',
	},
	{
		name:    'Acapulco Fresh 🌯',
		id:      'acapulcofresh',
		groupId: groupIds.commons
	},
	{
		name:    'Chandy\'s',
		id:      'chandys',
		groupId: groupIds.commons
	},
	{
		name:    'Just Poké 🐟',
		id:      'justpoke',
		groupId: groupIds.commons
	},
	{
		name:    'Kalia 🍛',
		id:      'kalia',
		groupId: groupIds.commons
	},
	{
		name:    'Hometown',
		id:      'hometown',
		groupId: groupIds.commons
	},
	{
		name:    'S\'wich 🥪',
		id:      's-wich',
		groupId: groupIds.commons
	},
	{
		name:    'Typhoon! 🍜',
		id:      'typhoon',
		groupId: groupIds.commons
	},
	{
		name: 'Boardwalk @ The Commons',
		id:   'boardwalk'
	},
	{
		name: 'in.gredients. Restaurant',
		id:   'in-gredients',
	},
	{
		name: 'Building 92 Espresso ☕',
		id:   'cafe92',
	},
	{
		name: 'Studio A Espresso ☕',
		id:   'studioa',
	},
	/*{
		friendlyName: "Studio B Espresso ☕",
		url: "studiob",
	},
	{
		friendlyName: "Studio C Espresso ☕",
		url: "studioc",
	},*/
	{
		name: 'Studio D Espresso ☕',
		id:   'studiod',
	},
	{
		name: 'Food Hall 6',
		id:   'foodhall6'
	},
	{
		name: 'Craft75 Pub (Building 6)',
		id:   'craft75'
	},
	{
		name:    'Dote ☕',
		id:      'dote',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name:    'The Collective 🧀',
		id:      'thecollective',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name:    'Salt & Straw 🍨',
		id:      'saltandstraw',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name:    'L\'Experience 🥐',
		id:      'l-experience',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name:    'Pinkabella Cupcakes 🧁',
		id:      'pinkabella',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name: 'Dote (Redmond Transit Station) ☕',
		id:   'dote-rts'
	},
	{
		name: 'General Store (Building 8)',
		id:   'generalstore'
	},
	{
		name: 'Food Hall 9',
		id:   'foodhall9'
	}
];