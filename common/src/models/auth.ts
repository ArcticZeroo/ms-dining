export interface IClientUserDTO {
	id: string;
	displayName: string;
	provider: string;
	createdAt: number;
	role: string;
	settings?: {
		favoriteStations: string[];
		favoriteMenuItems: string[];
		homepageIds: string[];
		lastUpdate: number;
	}
}

export interface IClientUser {
	id: string;
	displayName: string;
	provider: string;
	createdAt: Date;
	role: string;
	settings?: {
		favoriteStations: string[];
		favoriteMenuItems: string[];
		homepageIds: string[];
		lastUpdate: Date;
	}
}

export const PROVIDER_MICROSOFT = 'microsoft';
export const PROVIDER_GOOGLE = 'google';

export const DISPLAY_NAME_MAX_LENGTH_CHARS = 64;