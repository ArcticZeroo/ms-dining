import { IDiningHall, IDiningHallGroup } from '../models/dining-hall.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ url }: IDiningHall) => `https://${url}.buy-ondemand.com/api`;

export const groupIds = {
    commons:   'commons',
    building6: 'building6'
};

export const groups: IDiningHallGroup[] = [
    {
        name: 'The Commons',
        id:   groupIds.commons
    },
    {
        name: 'Building 6',
        id:   groupIds.building6
    }
];

export const diningHalls: IDiningHall[] = [
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
        name:    'Boardwalk (The Commons)',
        url:     'boardwalk',
        groupId: groupIds.commons
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
        url:     'foodhall6',
        groupId: groupIds.building6
    },
    {
        name:    'Local Flavors 6 (Dote)',
        url:     'dote',
        groupId: groupIds.building6
    }
]