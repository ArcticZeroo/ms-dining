export interface IErrorValidationState {
    isValid: false;
    rawValue: string;
    errorMessage: string;
}

export interface IValidValidationState<T> {
    isValid: true;
    rawValue: string;
    parsedValue: T;
}

export type ValidationState<T> = IErrorValidationState | IValidValidationState<T>;

export type Validator<T> = (value: string) => ValidationState<T>;