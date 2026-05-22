import type { IOrderCafePartSummary } from '@msdining/common/models/cart';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { getViewName } from '../../../util/cafe.ts';
import { formatPrice } from '../../../util/cart.ts';

interface IOrderItemsSummaryProps {
    cafeParts: IOrderCafePartSummary[];
}

export const OrderItemsSummary: React.FC<IOrderItemsSummaryProps> = ({ cafeParts }) => {
    const { viewsById } = useContext(ApplicationContext);

    const partsWithItems = cafeParts.filter(part => part.items.length > 0);

    if (partsWithItems.length === 0) {
        return null;
    }

    return (
        <div className="order-items-summary">
            {partsWithItems.map(part => {
                const view = viewsById.get(part.cafeId);
                const cafeName = view
                    ? getViewName({ view, showGroupName: true })
                    : part.cafeId;

                return (
                    <div key={part.cafeId}>
                        {partsWithItems.length > 1 && (
                            <div className="order-items-cafe-name">
                                {cafeName}
                            </div>
                        )}
                        <table className="cart-contents">
                            <tbody>
                                {part.items.map(item => (
                                    <tr key={item.id}>
                                        <td className="quantity">{item.quantity}x</td>
                                        <td>{item.menuItem.name}</td>
                                        <td className="price">{formatPrice(item.menuItem.price * item.quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {part.total != null && (
                            <div className="order-items-total">
                                Total: {formatPrice(part.total)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
