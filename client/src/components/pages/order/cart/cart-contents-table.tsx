import type { ICartItemRecord } from '@msdining/common/models/cart';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useCartItemActions } from '../../../../hooks/cart-item-actions.tsx';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { CafeView } from '../../../../models/cafe.ts';
import { useServerCartItemsByCafe } from '../../../../store/zustand/server-cart.ts';
import { getViewName } from '../../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../../util/link.ts';
import { sortViews } from '../../../../util/sorting.ts';
import { OrderPriceInlineTable } from '../order-price-inline-table.tsx';
import { CartItemRow } from './cart-item-row.tsx';
import './cart-contents-table.css';

interface ICartContentsTableProps {
    showFullDetails?: boolean;
    showTotalPrice?: boolean;
    readOnly?: boolean;
}

export const CartContentsTable: React.FC<ICartContentsTableProps> = ({ showFullDetails = false, showTotalPrice = false, readOnly = false }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const cartItemsByCafe = useServerCartItemsByCafe();
    const { onRemove, onEdit, onChangeQuantity } = useCartItemActions();

    const cartItemsByView = useMemo(
        () => {
            const groupedByView = new Map<CafeView, ICartItemRecord[]>();

            for (const [cafeId, items] of cartItemsByCafe) {
                const cafeView = viewsById.get(cafeId);

                if (cafeView == null) {
                    console.error('Could not get view for cafe id', cafeId);
                    continue;
                }

                groupedByView.set(cafeView, [...items]);
            }

            return groupedByView;
        },
        [cartItemsByCafe, viewsById]
    );

    const cartItemsView = useMemo(
        () => {
            const viewsInOrder = sortViews(cartItemsByView.keys());

            return viewsInOrder.map(view => (
                <React.Fragment key={view.value.id}>
                    <tr>
                        <th colSpan={4}>
                            <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="cart-cafe-url">
                                {getViewName({
                                    view,
                                    showGroupName: true
                                })}
                            </Link>
                        </th>
                    </tr>
                    {
                        cartItemsByView.get(view)?.map((item) => (
                            <CartItemRow
                                key={item.id}
                                showFullDetails={showFullDetails}
                                readOnly={readOnly}
                                item={item}
                                onRemove={() => onRemove(item)}
                                onEdit={() => onEdit(item)}
                                onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
                            />
                        ))
                    }
                </React.Fragment>
            ));
        },
        [cartItemsByView, viewsById, shouldUseGroups, showFullDetails, readOnly, onRemove, onEdit, onChangeQuantity]
    );

    return (
        <table className="cart-contents">
            <tbody>
                {cartItemsView}
                {
                    showTotalPrice && <OrderPriceInlineTable/>
                }
            </tbody>
        </table>
    );
};
