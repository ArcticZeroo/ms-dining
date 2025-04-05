export interface IClientUserDTO {
	id: string;
	displayName: string;
	provider: string;
	createdAt: number;
}

export interface IClientUser {
	id: string;
	displayName: string;
	provider: string;
	createdAt: Date;
}

export const PROVIDER_MICROSOFT = 'microsoft';
export const PROVIDER_GOOGLE = 'google';

export const DISPLAY_NAME_MAX_LENGTH_CHARS = 64;