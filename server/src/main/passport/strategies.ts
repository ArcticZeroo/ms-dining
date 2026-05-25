import MicrosoftStrategy from 'passport-microsoft';
import GoogleStrategy from 'passport-google-oauth20';
import { isDuckType } from '@arcticzeroo/typeguard';
import { DISPLAY_NAME_MAX_LENGTH_CHARS, PROVIDER_MICROSOFT } from '@msdining/common/models/auth';
import { requireEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../shared/constants/env.js';
import { IMicrosoftProfileData } from '../../shared/models/auth.js';
import { getServices } from '../../shared/services/registry.js';

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

        const user = {
            displayName: profile.displayName.slice(0, DISPLAY_NAME_MAX_LENGTH_CHARS),
            externalId:  profile.id,
            provider:    PROVIDER_MICROSOFT,
        };

        getServices().data.user.createUser({ user })
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
        const user = {
            displayName: profile.displayName.slice(0, DISPLAY_NAME_MAX_LENGTH_CHARS),
            externalId:  profile.id,
            provider:    'google',
        };

        getServices().data.user.createUser({ user })
            .then((createdUser) => done(null, createdUser.id))
            .catch(error => done(error));
    }
);