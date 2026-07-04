import { formatPrice } from '../../../util/cart.ts';

export const formatPercent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

export const formatSignedDollars = (amount: number): string => `${amount >= 0 ? '+' : '−'}${formatPrice(Math.abs(amount))}`;

export const formatSignedPercent = (fraction: number): string => `${fraction >= 0 ? '+' : '−'}${(Math.abs(fraction) * 100).toFixed(1)}%`;
