import React from 'react';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartHydrationContext } from '../../../context/cart.ts';
import { useContext } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { MissingCartItemRow } from './missing-cart-item-row.tsx';
import { ISerializedCartItemWithName } from '../../../models/cart.ts';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';
import { getParentView } from '../../../util/view.ts';
import { getViewName } from '../../../util/cafe.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';

export const MissingItemsTable = () => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const cartHydration = useValueNotifierContext(CartHydrationContext);
    const missingItems = cartHydration.missingItemsByCafeId ?? new Map<string, Array<ISerializedCartItemWithName>>();

    return (
        <table className="cart-missing-items">
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
                                                <Link to={getViewMenuUrl(getParentView(viewsById, view, shouldUseGroups))}
                                                    className="cart-cafe-url">
                                                    {getViewName(view, true /*showGroupName*/)}
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