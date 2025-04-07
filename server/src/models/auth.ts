export interface IMicrosoftProfileData {
	name: {
		familyName: string;
		givenName: string;
	},
	id: string,
	displayName: string,
	provider: string,
	userPrincipalName: string
}

export interface IServerUser {
	id: string,
	externalId: string,
	provider: string,
	displayName: string,
	role: string,
	createdAt: Date,
	settings?: {
		favoriteStations: string[],
		favoriteMenuItems: string[],
		homepageIds: string[],
		lastUpdate: Date
	}
}