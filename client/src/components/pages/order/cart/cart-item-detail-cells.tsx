import type { ICartItemRecord } from '@msdining/common/models/cart';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../../context/app.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { useCartItemPrice } from '../../../../hooks/cart.ts';
import { getSearchAnchorId, getViewMenuUrlDirect } from '../../../../util/link.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';
import { useServerCartHasAvailableItems } from '../../../../store/zustand/server-cart.js';

interface ICartItemDetailCellsProps {
    item: ICartItemRecord;
}

/**
 * Shared table cells for a cart item row: quantity, name (with optional
 * modifiers/instructions/unavailable badge), and price.
 *
 * Does not include the first column (controls) — that varies by context.
 */
export const CartItemDetailCells: React.FC<ICartItemDetailCellsProps> = ({ item }) => {
    const { viewsById } = useContext(ApplicationContext);
    const price = useCartItemPrice(item);
    const cartHasAnyAvailableItems = useServerCartHasAvailableItems();

    const itemUrl = useMemo(() => {
        const view = viewsById.get(item.menuItem.cafeId);
        if (!view) {
            return undefined;
        }
        const anchor = getSearchAnchorId({
            cafeId:     item.menuItem.cafeId,
            entityType: SearchEntityType.menuItem,
            name:       normalizeNameForSearch(item.menuItem.name),
        });
        return `${getViewMenuUrlDirect(view)}#${anchor}`;
    }, [viewsById, item.menuItem.cafeId, item.menuItem.name]);

    return (
        <>
            <td className="quantity">
                {item.quantity}x
            </td>
            <td className="name">
                <div className="full-details">
                    {
                        itemUrl != null
                            ? <Link to={itemUrl}>{item.menuItem.name}</Link>
                            : <span>{item.menuItem.name}</span>
                    }
                    {!item.isAvailable && cartHasAnyAvailableItems && <span className="cart-item-unavailable">Unavailable</span>}
                    <CartItemModifiers item={item}/>
                </div>
            </td>
            <td className="price">
                {formatPrice(price)}
            </td>
        </>
    );
};
