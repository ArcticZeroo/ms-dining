import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { INamedCartItem } from '../models/cart.ts';

export const CartContext = React.createContext(new ValueNotifier<Array<INamedCartItem>>([]));