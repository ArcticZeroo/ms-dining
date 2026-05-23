import type { ICartItemRecord } from '@msdining/common/models/cart';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { useServerCartUnavailableItems } from '../../../../store/zustand/server-cart.ts';
import { getViewName } from '../../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../../util/link.ts';
import { MissingCartItemRow } from './missing-cart-item-row.tsx';

export const MissingItemsTable = () => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const unavailableItems = useServerCartUnavailableItems();

    const unavailableItemsByCafe = useMemo(() => {
        const groupedItems = new Map<string, ICartItemRecord[]>();

        for (const item of unavailableItems) {
            const cafeId = item.menuItem.cafeId;
            const items = groupedItems.get(cafeId) ?? [];
            items.push(item);
            groupedItems.set(cafeId, items);
        }

        return groupedItems;
    }, [unavailableItems]);

    return (
        <table className="cart-contents cart-missing-items">
            <tbody>
                {
                    Array.from(unavailableItemsByCafe.entries())
                        .map(([cafeId, items]) => {
                            const view = viewsById.get(cafeId);
                            if (!view) {
                                return null;
                            }

                            return (
                                <React.Fragment key={cafeId}>
                                    <tr>
                                        <th colSpan={4}>
                                            <Link to={getViewMenuUrl({ viewsById, view, shouldUseGroups })} className="cart-cafe-url">
                                                {getViewName({
                                                    view,
                                                    showGroupName: true
                                                })}
                                            </Link>
                                        </th>
                                    </tr>
                                    {
                                        items.map((item) => (
                                            <MissingCartItemRow
                                                key={item.id}
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
};
