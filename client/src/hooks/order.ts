import { ValidationState, Validator } from '../models/validation.ts';
import { useCallback, useState } from 'react';

export const useFieldWithValidator = <T>(validator: Validator<T>, initialValue: string = '') => {
    const [validationState, setValidationState] = useState<ValidationState<T>>(() => validator(initialValue));

    const setValue = useCallback(
        (value: string) => {
            setValidationState(validator(value));
        },
        [validator]
    );

    return [validationState, setValue] as const;
};