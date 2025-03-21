import { ValueNotifier } from './events.ts';

export class CafesOnPageNotifier extends ValueNotifier<Set<string>> {
    protected readonly _cafesOnPage = new Map<string /*cafeId*/, Set<symbol>>();

    constructor() {
        super(new Set());
    }

    private _updateValue() {
        this.value = new Set(this._cafesOnPage.keys());
    }

    addCafe(cafeId: string, symbol: symbol) {
        if (!this._cafesOnPage.has(cafeId)) {
            this._cafesOnPage.set(cafeId, new Set());
            this._updateValue();
        }

        const symbols = this._cafesOnPage.get(cafeId)!;
        symbols.add(symbol);
    }

    removeCafe(cafeId: string, symbol: symbol) {
        if (!this._cafesOnPage.has(cafeId)) {
            return;
        }

        const symbols = this._cafesOnPage.get(cafeId)!;
        symbols.delete(symbol);

        if (symbols.size === 0) {
            this._cafesOnPage.delete(cafeId);
            this._updateValue();
        }
    }
}