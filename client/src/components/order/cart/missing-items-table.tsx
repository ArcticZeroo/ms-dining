import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { useCartStore } from '../../../store/zustand/cart.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { MissingCartItemRow } from './missing-cart-item-row.tsx';

export const MissingItemsTable = () => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const missingItems = useCartStore((state) => state.missingItemsByCafeId);

    // TODO: Consider folding this table into the main one
    return (
        <table className="cart-contents cart-missing-items">
            <tbody>
                {
                    Array.from(missingItems.entries())
                        .map(([cafeId, items]) => {
                            const view = viewsById.get(cafeId);

                            return (
                                <React.Fragment key={cafeId}>
                                    <th colSpan={4}>
                                        {
                                            view && (
                                                <Link to={getViewMenuUrl({ viewsById, view, shouldUseGroups })}
                                                    className="cart-cafe-url">
                                                    {getViewName({
                                                        view,
                                                        showGroupName: true
                                                    })}
                                                </Link>
                                            )
                                        }
                                        {
                                            !view && `Unknown Cafe (${cafeId})`
                                        }
                                    </th>
                                    {
                                        items.map(item => (
                                            <MissingCartItemRow
                                                key={item.itemId}
                                                cafeId={cafeId}
                                                item={item}
                                            />
                                        ))
                                    }
                                </React.Fragment>
                            );
                        })
                }
            </tbody>
        </table>
    );
}