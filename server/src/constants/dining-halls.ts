import { IDiningHall, IDiningHallGroup } from '../models/dining-hall.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ url }: IDiningHall) => `https://${url}.buy-ondemand.com/api`;

export const groupIds = {
    commons: 'commons'
};

export const groups: IDiningHallGroup[] = [
    {
        name: 'The Commons',
        id:   groupIds.commons
    }
];

export const diningHalls: IDiningHall[] = [
    {
        name: "Café 16",
        url:  "cafe16",
    },
    {
        name: "Café 25",
        url:  "cafe25",
    },
    {
        name: "Café 31",
        url:  "cafe31",
    },
    {
        name: "Café 34",
        url:  "cafe34",
    },
    {
        name: "Café 36",
        url:  "cafe36",
    },
    {
        name: "Café 37",
        url:  "cafe37",
    },
    {
        name: "Café 40/41",
        url:  "cafe40-41",
    },
    {
        name: "Café 43",
        url:  "cafe43",
    },
    {
        name: "Café 50",
        url:  "cafe50",
    },
    {
        name: "Café 83",
        url:  "cafe83",
    },
    {
        name: "Café 86",
        url:  "cafe86",
    },
    {
        name: "Café 99",
        url:  "cafe99",
    },
    {
        name: "Café 109",
        url:  "cafe109",
    },
    {
        name: "Café 112",
        url:  "cafe112",
    },
    {
        name: "Café 121",
        url:  "cafe121",
    },
    {
        name: "Café RedWest",
        url:  "caferedwest",
    },
    {
        name: "Café RTC",
        url:  "cafertc5",
    },
    {
        name: "Café Studio H",
        url:  "cafestudioh",
    },
    {
        name: "One Esterra Food Hall",
        url:  "one-esterra",
    },
    {
        name:      "Acapulco Fresh (The Commons)",
        url:       "acapulcofresh",
        groupName: groupIds.commons
    },
    {
        name:      "Chandy's (The Commons)",
        url:       "chandys",
        groupName: groupIds.commons
    },
    {
        name:      "Just Poké (The Commons)",
        url:       "justpoke",
        groupName: groupIds.commons
    },
    {
        name:      "Kalia (The Commons)",
        url:       "kalia",
        groupName: groupIds.commons
    },
    {
        name:      "Hometown (The Commons)",
        url:       "hometown",
        groupName: groupIds.commons
    },
    {
        name:      "S'wich (The Commons)",
        url:       "s-wich",
        groupName: groupIds.commons
    },
    {
        name:      "Typhoon! (The Commons)",
        url:       "typhoon",
        groupName: groupIds.commons
    },
    {
        name:      "Boardwalk (The Commons)",
        url:       "boardwalk",
        groupName: groupIds.commons
    },
    {
        name: "in.gredients. Restaurant",
        url:  "in-gredients",
    },
    {
        name: "Building 92 Espresso",
        url:  "cafe92",
    },
    {
        name: "Studio A Espresso",
        url:  "studioa",
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
        name: "Studio D Espresso",
        url:  "studiod",
    }
]