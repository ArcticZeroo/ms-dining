const getOneRemInPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

export class Measurement {
    public readonly inPixels: number;

    private constructor(pixels: number) {
        this.inPixels = Math.round(pixels);
    }

    public static fromRem(rem: number) {
        return new Measurement(rem * getOneRemInPx());
    }

    public static fromPixels(px: number) {
        return new Measurement(px);
    }

    public get inRem(): number {
        return this.inPixels / getOneRemInPx();
    }
}
