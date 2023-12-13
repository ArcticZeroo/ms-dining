export interface ICartItemModifier {
    modifierId: string;
    choiceId: string;
}

export interface ICartItem {
    itemId: string;
    quantity: number;
    modifiers: ICartItemModifier[];
    specialInstructions?: string;
}