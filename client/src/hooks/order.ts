import { ValidationState } from '../models/validation.ts';
import { useCallback, useState } from 'react';

export const useFieldWithValidator = <T>(validator: (value: string) => ValidationState<T>) => {
    // Empty string might be valid for some validators, so get the initial state from the validator.
    const [validationState, setValidationState] = useState<ValidationState<T>>(() => validator(''));

    const setValue = useCallback(
        (value: string) => {
            setValidationState(validator(value));
        },
        [validator]
    );

    return [validationState, setValue] as const;
};