import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { ICartItemWithMetadata, ISerializedCartItemWithName } from '../models/cart.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';

export type CartItemsByCafeId = Map<string, Map<string, ICartItemWithMetadata>>;

export interface ICartHydrationState {
    stage: PromiseStage;
    missingItemsByCafeId?: Map<string, Array<ISerializedCartItemWithName>>;
}

export const CartContext = React.createContext(new ValueNotifier<CartItemsByCafeId>(new Map()));

export const CartHydrationContext = React.createContext(new ValueNotifier<ICartHydrationState>({
    stage:                PromiseStage.notRun
}));