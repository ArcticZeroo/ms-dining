import phone from 'phone';
import { ValidationState, Validator } from '../models/validation.ts';

export const expectValid = <T>(validationState: ValidationState<T>): T => {
    if (!validationState.isValid) {
        throw new Error(validationState.errorMessage);
    }

    return validationState.parsedValue;
}

export const expectError = (validationState: ValidationState<unknown>) => {
    if (validationState.isValid) {
        throw new Error('Expected error but got success');
    }

    return validationState.errorMessage;
}

export const validatePhoneNumber: Validator<string> = (rawValue: string) => {
    const result = phone(rawValue);

    if (!result.isValid) {
        return {
            isValid: false,
            errorMessage: 'Invalid phone number',
            rawValue
        };
    }

    if (!result.phoneNumber.startsWith('+')) {
        return {
            isValid: false,
            errorMessage: 'Phone number is missing country code',
            rawValue
        };
    }

    return {
        isValid: true,
        parsedValue: result.phoneNumber,
        rawValue
    };
};

const EXPIRATION_MONTH_REGEX = /^(?<year>\d{4})-(?<month>\d{2})$/;

export interface IExpirationMonth {
    year: number;
    month: number;
}

export const validateExpirationMonth: Validator<IExpirationMonth> = (rawValue: string) => {
    const match = rawValue.match(EXPIRATION_MONTH_REGEX);

    if (!match?.groups) {
        return {
            isValid: false,
            errorMessage: 'Invalid expiration month',
            rawValue
        };
    }

    const year = Number(match.groups.year);
    const month = Number(match.groups.month);

    const now = new Date();

    if (year < now.getFullYear()) {
        return {
            isValid: false,
            errorMessage: 'Expiration month is in the past',
            rawValue
        };
    }

    // Remind me again why month is zero-indexed but nothing else is?
    if (year === now.getFullYear() && month < (now.getMonth() + 1)) {
        return {
            isValid: false,
            errorMessage: 'Expiration month is in the past',
            rawValue
        };
    }

    if (month < 1 || month > 12) {
        return {
            isValid: false,
            errorMessage: 'Expiration month is out of expected range (1-12)',
            rawValue
        };
    }

    return {
        isValid: true,
        parsedValue: {
            year,
            month
        },
        rawValue
    };
}

export const getRegexValidator = (regex: RegExp, errorMessage: string): Validator<string> => {
    return (rawValue: string) => {
        if (!regex.test(rawValue)) {
            return {
                isValid: false,
                errorMessage,
                rawValue
            };
        }

        return {
            isValid: true,
            parsedValue: rawValue,
            rawValue
        };
    };
}

// This should be based on card type, but for now it's fine
export const validateSecurityCode = getRegexValidator(/^\d{3,4}$/, 'Invalid CVV');