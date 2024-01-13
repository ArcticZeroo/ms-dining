import { ICafe, ICafeGroup } from '../models/cafe.js';
import { DateUtil } from '@msdining/common';

export const getBaseApiUrlWithoutTrailingSlash = ({ id }: ICafe) => `https://${id}.buy-ondemand.com/api`;

export const groupIds = {
    commons:               'commons',
    localFlavorsBuilding6: 'local-flavors',
    building4:             'building4',
    individual:            'individual',
    restaurants:           'restaurants',
    espresso:              'espresso'
};

export const groupList: ICafeGroup[] = [
    {
        name: 'Individual Cafés',
        id:
              groupIds.individual,
        alwaysExpand:
              true,
        members:
              [
                  {
                      name:   'Food Hall 6',
                      id:     'foodhall6',
                      number: 6,
                  },
                  {
                      name:   'Food Hall 9',
                      id:     'foodhall9',
                      number: 9
                  },
                  {
                      name:   'Café 16',
                      id:     'cafe16',
                      number: 16
                  },
                  {
                      name:   'Café 25',
                      id:     'cafe25',
                      number: 25
                  },
                  {
                      name:   'Café 31',
                      id:     'cafe31',
                      number: 31
                  },
                  {
                      name:   'Café 34',
                      id:     'cafe34',
                      number: 34
                  },
                  {
                      name:   'Café 36',
                      id:     'cafe36',
                      number: 36
                  },
                  {
                      name:   'Café 37',
                      id:     'cafe37',
                      number: 37
                  },
                  {
                      name:   'Café 40/41',
                      id:     'cafe40-41',
                      number: 40
                  },
                  {
                      name:   'Café 43',
                      id:     'cafe43',
                      number: 43
                  },
                  {
                      name:   'Café 50',
                      id:     'cafe50',
                      number: 50
                  },
                  {
                      name:   'Café 83',
                      id:     'cafe83',
                      number: 83
                  },
                  {
                      name:   'Café 86',
                      id:     'cafe86',
                      number: 86
                  },
                  {
                      name:   'Café 99',
                      id:     'cafe99',
                      number: 99
                  },
                  {
                      name:   'Café 109',
                      id:     'cafe109',
                      number: 109
                  },
                  {
                      name:   'Café 112',
                      id:     'cafe112',
                      number: 112
                  },
                  {
                      name:   'Café 121',
                      id:     'cafe121',
                      number: 121
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
                      name: 'General Store (Building 8)',
                      id:   'generalstore',
                  },
              ]
    },
    {
        name:    'Commons',
        id:      groupIds.commons,
        members: [
            {
                name: 'Acapulco Fresh 🌯',
                id:   'acapulcofresh',
            },
            {
                name: 'Chandy\'s',
                id:   'chandys',
            },
            {
                name: 'Just Poké 🐟',
                id:   'justpoke',
            },
            {
                name: 'Kalia 🍛',
                id:   'kalia',
            },
            {
                name: 'Hometown',
                id:   'hometown',
            },
            {
                name: 'S\'wich 🥪',
                id:   's-wich',
            },
            {
                name: 'Typhoon! 🍜',
                id:   'typhoon',
            },
        ]
    },
    {
        name:    'Food Hall 4',
        id:      groupIds.building4,
        number:  4,
        members: [
            {
                name:   'Food Hall 4',
                id:     'foodhall4',
                number: 4
            },
            {
                name: 'Jack\'s BBQ 🍖',
                id:   'fh4jacksbbq',
            },
            {
                name:    'Joe\'s Burgers 🍔',
                id:      'fh4joesburger',
            },
            {
                name: 'Just Poke 🐟',
                id:   'fh4justpoke',
            },
            {
                name:           'MiLa',
                id:             'fh4mila',
                firstAvailable: new Date(2024, DateUtil.nativeMonth.January, 2)
            },
            {
                name: 'Paparepas',
                id:   'fh4papparepas',
            },
            {
                name: 'Boon Boona ☕',
                id:   'fh4boonboona',
            }
        ]
    },
    {
        name:    'Local Flavors @ Building 6',
        id:      groupIds.localFlavorsBuilding6,
        members: [
            {
                name: 'Dote ☕',
                id:   'dote',
            },
            {
                name: 'The Collective 🧀',
                id:   'thecollective',
            },
            {
                name: 'Salt & Straw 🍨',
                id:   'saltandstraw',
            },
            {
                name: 'L\'Experience 🥐',
                id:   'l-experience',
            },
            {
                name: 'Pinkabella Cupcakes 🧁',
                id:   'pinkabella',
            },
        ]
    },
    {
        name:         'Restaurants',
        id:           groupIds.restaurants,
        alwaysExpand: true,
        members:      [
            {
                name: 'Boardwalk @ The Commons',
                id:   'boardwalk'
            },
            {
                name: 'Craft75 Pub @ Building 6',
                id:   'craft75',
            },
            {
                name: 'in.gredients @ Building 34',
                id:   'in-gredients',
                url:  'https://dining.azurewebsites.net/ingredients/'
            },
        ]
    },
    {
        name:         'Espresso',
        id:           groupIds.espresso,
        alwaysExpand: true,
        members:      [
            {
                name: 'Studio A Espresso ☕',
                id:   'studioa',
            },
            {
                name:   'Building 92 Espresso ☕',
                id:     'cafe92',
                number: 92,
            },
            {
                name: 'Studio D Espresso ☕',
                id:   'studiod',
            },
            {
                name: 'Dote (Redmond Transit Station) ☕',
                id:   'dote-rts'
            },
            {
                name: 'Building 3 Espresso ☕',
                id:   'b3espresso'
            },
            {
                name: 'Building 7 Espresso ☕',
                id:   'b7espresso'
            },
            /*{
                friendlyName: "Studio B Espresso ☕",
                url: "studiob",
            },
            {
                friendlyName: "Studio C Espresso ☕",
                url: "studioc",
            },*/
        ]
    },
];

export const cafeList = groupList.flatMap(group => group.members);