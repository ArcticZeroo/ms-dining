interface ICartItemModifier {
	parentGroupId: string;
	selectedOptionId: string;
	quantity: number;
}

interface ICartItem {
	itemId: string;
	quantity: number;
	modifiers: [];
	specialInstructions?: string;
}

interface ICart {
	items: ICartItem[];
}