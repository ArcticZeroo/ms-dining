import MicrosoftStrategy from 'passport-microsoft';
import GoogleStrategy from 'passport-google-oauth20';
import { isDuckType } from '@arcticzeroo/typeguard';
import { Prisma } from '@prisma/client';
import { DISPLAY_NAME_MAX_LENGTH_CHARS, PROVIDER_MICROSOFT } from '@msdining/common/models/auth';
import { UserStorageClient } from '../api/storage/clients/user.js';
import { requireEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../constants/env.js';
import { IMicrosoftProfileData } from '../models/auth.js';

export const getMicrosoftStrategy = () => new MicrosoftStrategy.Strategy(
	{
		clientID:     requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientId),
		clientSecret: requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientSecret),
		callbackURL:  requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftCallbackUrl),
		scope:        ['user.read']
	},
	(accessToken, refreshToken, params, profile, done) => {
		if (!isDuckType<IMicrosoftProfileData>(profile, { userPrincipalName: 'string', displayName: 'string' })) {
			done(new Error('Invalid profile data'), profile);
			return;
		}

		const user: Prisma.UserCreateInput = {
			displayName: profile.displayName.slice(0, DISPLAY_NAME_MAX_LENGTH_CHARS),
			externalId:  profile.id,
			provider:    PROVIDER_MICROSOFT,
		};

		UserStorageClient.createUserAsync(user)
			.then((createdUser) => done(null, createdUser.id))
			.catch(error => done(error));
	}
);

export const getGoogleStrategy = () => new GoogleStrategy.Strategy(
	{
		clientID:     requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleClientId),
		clientSecret: requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleClientSecret),
		callbackURL:  requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleCallbackUrl),
		scope:        ['https://www.googleapis.com/auth/userinfo.profile']
	},
	(accessToken, refreshToken, profile, done) => {
		const user: Prisma.UserCreateInput = {
			displayName: profile.displayName.slice(0, DISPLAY_NAME_MAX_LENGTH_CHARS),
			externalId:  profile.id,
			provider:    'google',
		};

		UserStorageClient.createUserAsync(user)
			.then((createdUser) => done(null, createdUser.id))
			.catch(error => done(error));
	}
);