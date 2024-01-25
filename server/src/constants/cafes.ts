import { CafeGroup, ICafe } from '../models/cafe.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ id }: ICafe) => `https://${id}.buy-ondemand.com/api`;

export const groupIds = {
    commons:               'commons',
    localFlavorsBuilding6: 'local-flavors',
    building4:             'building4',
    building9:             'building9',
    individual:            'individual',
    restaurants:           'restaurants',
    espresso:              'espresso'
};

export const groupList: CafeGroup[] = [
    {
        name:         'Individual Cafés',
        id:           groupIds.individual,
        alwaysExpand: true,
        members:      [
            {
                name:     'Food Hall 6',
                id:       'foodhall6',
                number:   6,
                location: {
                    lat:  47.64173744897988,
                    long: -122.13015430238059
                }
            },
            {
                name:     'Café 16',
                id:       'cafe16',
                number:   16,
                location: {
                    lat:  47.643507904616044,
                    long: -122.12845125402096
                }
            },
            {
                name:     'Café 25',
                id:       'cafe25',
                number:   25,
                location: {
                    lat:  47.64517070133711,
                    long: -122.13088371497581
                }
            },
            {
                name:     'Café 31',
                id:       'cafe31',
                number:   31,
                location: {
                    lat:  47.644298609820716,
                    long: -122.12196099869949
                }
            },
            {
                name:     'Café 34',
                id:       'cafe34',
                number:   34,
                location: {
                    lat:  47.64473336241571,
                    long: -122.1246032387795
                }
            },
            {
                name:     'Café 36',
                id:       'cafe36',
                number:   36,
                location: {
                    lat:  47.64063771154742,
                    long: -122.12341603251966
                }
            },
            {
                name:     'Café 37',
                id:       'cafe37',
                number:   37,
                location: {
                    lat:  47.6382294573152,
                    long: -122.12598086868739
                }
            },
            {
                name:     'Café 40/41',
                id:       'cafe40-41',
                number:   40,
                location: {
                    lat:  47.63699948153514,
                    long: -122.13287156157851
                }
            },
            {
                name:     'Café 43',
                id:       'cafe43',
                number:   43,
                location: {
                    lat:  47.64005323853203,
                    long: -122.13358273507018
                }
            },
            {
                name:     'Café 50',
                id:       'cafe50',
                number:   50,
                location: {
                    lat:  47.64714781517253,
                    long: -122.13405726860293
                }
            },
            {
                name:     'Café 83',
                id:       'cafe83',
                number:   83,
                location: {
                    lat:  47.6489920022777,
                    long: -122.13344132552533
                }
            },
            {
                name:     'Café 86',
                id:       'cafe86',
                number:   86,
                location: {
                    lat:  47.651973409594916,
                    long: -122.13407167598774
                }
            },
            {
                name:     'Café 99',
                id:       'cafe99',
                number:   99,
                location: {
                    lat:  47.642358522158176,
                    long: -122.14181128625899
                }
            },
            {
                name:     'Café 109',
                id:       'cafe109',
                number:   109,
                location: {
                    lat:  47.637485779201214,
                    long: -122.14001840124935
                }
            },
            {
                name:     'Café 112',
                id:       'cafe112',
                number:   112,
                location: {
                    lat:  47.640673485809224,
                    long: -122.14114144772182
                }
            },
            {
                name:     'Café 121',
                id:       'cafe121',
                number:   121,
                location: {
                    lat:  47.64774631636792,
                    long: -122.1369534763148
                }
            },
            {
                name:     'Café RedWest',
                id:       'caferedwest',
                location: {
                    lat:  47.65990048055115,
                    long: -122.14119452231051
                }
            },
            {
                name:     'Café RTC',
                id:       'cafertc5',
                location: {
                    lat:  47.66926669039128,
                    long: -122.12341775252429
                }
            },
            {
                name:     'Café Studio H',
                id:       'cafestudioh',
                location: {
                    lat:  47.64372822879307,
                    long: -122.14103953027507
                }
            },
            {
                name:     'One Esterra Food Hall',
                id:       'one-esterra',
                location: {
                    lat:  47.635412206124535,
                    long: -122.13318512974796
                }
            },
            {
                name:     'General Store (Building 8)',
                id:       'generalstore',
                location: {
                    lat:  47.64121784464865,
                    long: -122.13128667829052
                }
            },
        ]
    },
    {
        name:     'Commons',
        id:       groupIds.commons,
        location: {
            lat:  47.64453785085142,
            long: -122.1369674720719
        },
        members:  [
            // Acapulco has been shut down for now
            /*{
                name: 'Acapulco Fresh 🌯',
                id:   'acapulcofresh',
            },*/
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
        name:     'Food Hall 4',
        id:       groupIds.building4,
        number:   4,
        location: {
            lat:  47.64139514439134,
            long: -122.12921998413715
        },
        members:  [
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
                name: 'Joe\'s Burgers 🍔',
                id:   'fh4joesburger',
            },
            {
                name: 'Just Poke 🐟',
                id:   'fh4justpoke',
            },
            {
                name: 'MiLa',
                id:   'fh4mila',
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
        name:     'Food Hall 9',
        id:       groupIds.building9,
        number:   9,
        location: {
            lat:  47.64057151717557,
            long: -122.13121841044659
        },
        members:  [
            {
                name:   'Food Hall 9',
                id:     'foodhall9',
                number: 9
            },
            {
                name: 'Big Chicken 🐔',
                id:   'fh9bigchicken',
            }
        ]
    },
    {
        name:     'Local Flavors @ Building 6',
        id:       groupIds.localFlavorsBuilding6,
        location: {
            lat:  47.64159551663974,
            long: -122.13011468582364
        },
        members:  [
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
                name:     'Boardwalk @ The Commons',
                id:       'boardwalk',
                location: {
                    lat:  47.64413039594152,
                    long: -122.13782494045122
                }
            },
            {
                name:     'Craft75 Pub @ Building 6',
                id:       'craft75',
                location: {
                    lat:  47.64129449740462,
                    long: -122.13052769248961
                }
            },
            {
                name:     'in.gredients @ Building 34',
                id:       'in-gredients',
                url:      'https://dining.azurewebsites.net/ingredients/',
                location: {
                    lat:  47.64471682290945,
                    long: -122.12446558666647
                }
            },
        ]
    },
    {
        name:         'Espresso',
        id:           groupIds.espresso,
        alwaysExpand: true,
        members:      [
            {
                name:     'Studio A Espresso ☕',
                id:       'studioa',
                location: {
                    lat:  47.645316558098074,
                    long: -122.13678762604209
                }
            },
            {
                name:     'Building 92 Espresso ☕',
                id:       'cafe92',
                number:   92,
                location: {
                    lat:  47.64232532832751,
                    long: -122.13684060201219
                }
            },
            {
                name:     'Studio D Espresso ☕',
                id:       'studiod',
                location: {
                    lat:  47.64325500566002,
                    long: -122.13567517255862
                }
            },
            {
                name:     'Dote (Redmond Transit Station) ☕',
                id:       'dote-rts',
                location: {
                    lat:  47.643977648867136,
                    long: -122.13258291975033
                }
            },
            {
                name:     'Building 3 Espresso ☕',
                id:       'b3espresso',
                location: {
                    lat:  47.64183997826611,
                    long: -122.12835725074191
                }
            },
            {
                name:     'Building 7 Espresso ☕',
                id:       'b7espresso',
                location: {
                    lat:  47.64205692938408,
                    long: -122.13128847834109
                }
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