interface IClampParams {
    min: number;
    max: number;
    value: number;
}

export const clamp = ({ min, max, value }: IClampParams) => Math.min(Math.max(value, min), max);