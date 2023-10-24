import { ICafe, ICafeGroup } from '../models/cafe.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ url }: ICafe) => `https://${url}.buy-ondemand.com/api`;

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
		url:  'cafe16',
	},
	{
		name: 'Café 25',
		url:  'cafe25',
	},
	{
		name: 'Café 31',
		url:  'cafe31',
	},
	{
		name: 'Café 34',
		url:  'cafe34',
	},
	{
		name: 'Café 36',
		url:  'cafe36',
	},
	{
		name: 'Café 37',
		url:  'cafe37',
	},
	{
		name: 'Café 40/41',
		url:  'cafe40-41',
	},
	{
		name: 'Café 43',
		url:  'cafe43',
	},
	{
		name: 'Café 50',
		url:  'cafe50',
	},
	{
		name: 'Café 83',
		url:  'cafe83',
	},
	{
		name: 'Café 86',
		url:  'cafe86',
	},
	{
		name: 'Café 99',
		url:  'cafe99',
	},
	{
		name: 'Café 109',
		url:  'cafe109',
	},
	{
		name: 'Café 112',
		url:  'cafe112',
	},
	{
		name: 'Café 121',
		url:  'cafe121',
	},
	{
		name: 'Café RedWest',
		url:  'caferedwest',
	},
	{
		name: 'Café RTC',
		url:  'cafertc5',
	},
	{
		name: 'Café Studio H',
		url:  'cafestudioh',
	},
	{
		name: 'One Esterra Food Hall',
		url:  'one-esterra',
	},
	{
		name:    'Acapulco Fresh (The Commons)',
		url:     'acapulcofresh',
		groupId: groupIds.commons
	},
	{
		name:    'Chandy\'s (The Commons)',
		url:     'chandys',
		groupId: groupIds.commons
	},
	{
		name:    'Just Poké (The Commons)',
		url:     'justpoke',
		groupId: groupIds.commons
	},
	{
		name:    'Kalia (The Commons)',
		url:     'kalia',
		groupId: groupIds.commons
	},
	{
		name:    'Hometown (The Commons)',
		url:     'hometown',
		groupId: groupIds.commons
	},
	{
		name:    'S\'wich (The Commons)',
		url:     's-wich',
		groupId: groupIds.commons
	},
	{
		name:    'Typhoon! (The Commons)',
		url:     'typhoon',
		groupId: groupIds.commons
	},
	{
		name:    'Boardwalk @ The Commons',
		url:     'boardwalk'
	},
	{
		name: 'in.gredients. Restaurant',
		url:  'in-gredients',
	},
	{
		name: 'Building 92 Espresso',
		url:  'cafe92',
	},
	{
		name: 'Studio A Espresso',
		url:  'studioa',
	},
	/*{
		friendlyName: "Studio B Espresso",
		url: "studiob",
	},
	{
		friendlyName: "Studio C Espresso",
		url: "studioc",
	},*/
	{
		name: 'Studio D Espresso',
		url:  'studiod',
	},
	{
		name:    'Food Hall 6',
		url:     'foodhall6'
	},
	{
		name:    'Craft75 Pub (Building 6)',
		url:     'craft75'
	},
	{
		name:    'Dote (Local Flavors @ Building 6)',
		url:     'dote',
		groupId: groupIds.localFlavorsBuilding6
	},
	{
		name:    'The Collective 🧀 (Local Flavors @ Building 6)',
		url:     'thecollective',
		groupId: groupIds.localFlavorsBuilding6
	},
    {
        name:    'Salt & Straw (Local Flavors @ Building 6)',
        url:     'saltandstraw',
        groupId: groupIds.localFlavorsBuilding6
    },
    {
        name:    'L\'Experience (Local Flavors @ Building 6)',
        url:     'l-experience',
        groupId: groupIds.localFlavorsBuilding6
    },
    {
        name:    'Pinkabella Cupcakes (Local Flavors @ Building 6)',
        url:     'pinkabella',
        groupId: groupIds.localFlavorsBuilding6
    },
	{
		name: 'Dote (Redmond Transit Station)',
		url:  'dote-rts'
	}
];