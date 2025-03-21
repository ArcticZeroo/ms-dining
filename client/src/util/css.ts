import { Measurement } from './measurement.ts';

export const getCssVariable = (variableName: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName);
}

export const getConstantPadding = () => Measurement.fromCssString(getCssVariable('--constant-padding'));