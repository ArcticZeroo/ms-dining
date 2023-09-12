import { IDiningHall } from '../models/dining-hall.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ url }: IDiningHall) => `https://${url}.buy-ondemand.com/api`;

export const diningHalls: IDiningHall[] = [
    {
        friendlyName: "Café 16",
        url: "cafe16",
    },
    {
        friendlyName: "Café 25",
        url: "cafe25",
    },
    {
        friendlyName: "Café 31",
        url: "cafe31",
    },
    {
        friendlyName: "Café 34",
        url: "cafe34",
    },
    {
        friendlyName: "Café 36",
        url: "cafe36",
    },
    {
        friendlyName: "Café 37",
        url: "cafe37",
    },
    {
        friendlyName: "Café 40/41",
        url: "cafe40-41",
    },
    {
        friendlyName: "Café 43",
        url: "cafe43",
    },
    {
        friendlyName: "Café 50",
        url: "cafe50",
    },
    {
        friendlyName: "Café 83",
        url: "cafe83",
    },
    {
        friendlyName: "Café 86",
        url: "cafe86",
    },
    {
        friendlyName: "Café 99",
        url: "cafe99",
    },
    {
        friendlyName: "Café 109",
        url: "cafe109",
    },
    {
        friendlyName: "Café 112",
        url: "cafe112",
    },
    {
        friendlyName: "Café 121",
        url: "cafe121",
    },
    {
        friendlyName: "Café Advanta",
        url: "cafeadvanta",
    },
    {
        friendlyName: "Café Bravern 1",
        url: "cafebravern1",
    },
    {
        friendlyName: "Café Bravern 2",
        url: "cafebravern2",
    },
    {
        friendlyName: "Boardwalk Restaurant",
        url: "boardwalk",
    },
    {
        friendlyName: "Café City Center",
        url: "cafecitycenter",
    },
    {
        friendlyName: "Café Lincoln Square",
        url: "cafelincolnsquare",
    },
    {
        friendlyName: "Café Millennium",
        url: "cafemille",
    },
    {
        friendlyName: "Café RedWest",
        url: "caferedwest",
    },
    {
        friendlyName: "Café RTC",
        url: "cafertc5",
    },
    {
        friendlyName: "Café Sammamish C",
        url: "cafesammc",
    },
    {
        friendlyName: "Café Studio H",
        url: "cafestudioh",
    },
    {
        friendlyName: "One Esterra Food Hall",
        url: "one-esterra",
    },
    {
        friendlyName: "Acapulco Fresh (The Commons)",
        url: "acapulcofresh",
    },
    {
        friendlyName: "Boardwalk (The Commons)",
        url: "boardwalk",
    },
    {
        friendlyName: "Chandy's (The Commons)",
        url: "chandys",
    },
    {
        friendlyName: "Gather + Co (The Commons)",
        url: "gatco",
    },
    {
        friendlyName: "in.gredients. Restaurant",
        url: "in-gredients",
    },
    {
        friendlyName: "Kalia (The Commons)",
        url: "kalia",
    },
    {
        friendlyName: "PAC NW Pizza (The Commons)",
        url: "pnwpizza",
    },
    {
        friendlyName: "Paseo (The Commons)",
        url: "paseo",
    },
    {
        friendlyName: "The Classic (The Commons)",
        url: "theclassic",
    },
    {
        friendlyName: "Typhoon! (The Commons)",
        url: "typhoon",
    },
    {
        friendlyName: "The Learning Center (B92) Espresso",
        url: "cafe92",
    },
    {
        friendlyName: "Studio A Espresso",
        url: "studioa",
    },
    {
        friendlyName: "Studio B Espresso",
        url: "studiob",
    },
    {
        friendlyName: "Studio C Espresso",
        url: "studioc",
    },
    {
        friendlyName: "Studio D Espresso",
        url: "studiod",
    }
]