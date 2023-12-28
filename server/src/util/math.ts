interface IClampParams {
    min: number;
    max: number;
    value: number;
}

export const clamp = ({ min, max, value }: IClampParams) => Math.min(Math.max(value, min), max);

export const fixed = (value: number, precision: number) => {
    const factor = Math.pow(10, precision);
    return Math.trunc(value * factor) / factor;
}