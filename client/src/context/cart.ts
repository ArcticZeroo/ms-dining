import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { ICartItemWithMetadata } from '../models/cart.ts';

export const CartContext = React.createContext(new ValueNotifier<Array<ICartItemWithMetadata>>([]));