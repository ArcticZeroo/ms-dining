import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { ICartItemWithMetadata } from '../models/cart.ts';

export type CartItemsByCafeId = Map<string, Map<string, ICartItemWithMetadata>>;

export const CartContext = React.createContext(new ValueNotifier<CartItemsByCafeId>(new Map()));