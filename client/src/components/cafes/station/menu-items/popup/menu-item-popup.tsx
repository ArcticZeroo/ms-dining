import { CafeTypes } from '@msdining/common';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApplicationSettings } from '../../../../../api/settings.ts';
import { ApplicationContext } from '../../../../../context/app.ts';
import { CartContext } from '../../../../../context/cart.ts';
import { PopupContext } from '../../../../../context/modal.ts';
import { SelectedDateContext } from '../../../../../context/time.ts';
import { useValueNotifier } from '../../../../../hooks/events.ts';
import { IMenuItem } from '../../../../../models/cafe.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { addOrEditCartItem, shallowCloneCart } from '../../../../../util/cart.ts';
import { getRandomId } from '../../../../../util/id.ts';
import { getViewMenuUrlWithJump } from '../../../../../util/link.ts';
import { navigateToSearch } from '../../../../../util/search.ts';
import { getParentView } from '../../../../../util/view.ts';
import { FavoriteItemButton } from '../../../../button/favorite-item-button.tsx';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemPopupBody } from './menu-item-popup-body.tsx';
import { MenuItemPopupFooter } from './menu-item-popup-footer.tsx';

import './menu-item-popup.css';

const calculatePrice = (menuItem: IMenuItem, selectedChoiceIdsByModifierId: Map<string, Set<string>>): number => {
    let price = menuItem.price;

    for (const modifier of menuItem.modifiers) {
        const selectedChoiceIds = selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();

        for (const choice of modifier.choices) {
            if (selectedChoiceIds.has(choice.id)) {
                price += choice.price;
            }
        }
    }

    return price;
};

const useIsOrderValid = (menuItem: IMenuItem, getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>): boolean => {
    return useMemo(
        () => {
            for (const modifier of menuItem.modifiers) {
                const selectedChoiceIds = getSelectedChoiceIdsForModifier(modifier);

                if (selectedChoiceIds.size < modifier.minimum) {
                    return false;
                }

                if (selectedChoiceIds.size > modifier.maximum) {
                    return false;
                }
            }

            return true;
        },
        [menuItem, getSelectedChoiceIdsForModifier]
    );
};

interface IMenuItemPopupProps {
    menuItem: IMenuItem;
    modalSymbol: symbol;
    cafeId: string;
    fromCartItem?: ICartItemWithMetadata;
}

export const MenuItemPopup: React.FC<IMenuItemPopupProps> = ({ menuItem, modalSymbol, cafeId, fromCartItem }) => {
    const isUpdate = fromCartItem != null;

    const navigate = useNavigate();

    const { viewsById } = useContext(ApplicationContext);
    const selectedDateNotifier = useContext(SelectedDateContext);

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);
    const [copyButtonBackground, setCopyButtonBackground] = useState<string | undefined>(undefined);

    const cartItemsNotifier = useContext(CartContext);
    const modalNotifier = useContext(PopupContext);

    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const closeModal = () => {
        if (modalNotifier.value?.id === modalSymbol) {
            modalNotifier.value = null;
        }
    };

    const getSelectedChoiceIdsForModifier = useCallback((modifier: CafeTypes.IMenuItemModifier) => {
        return selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();
    }, [selectedChoiceIdsByModifierId]);

    const onSelectedChoiceIdsChanged = (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => {
        const newSelectedChoiceIdsByModifierId = new Map(selectedChoiceIdsByModifierId);
        newSelectedChoiceIdsByModifierId.set(modifier.id, selection);
        setSelectedChoiceIdsByModifierId(newSelectedChoiceIdsByModifierId);
    };

    const totalPrice = useMemo(
        () => calculatePrice(menuItem, selectedChoiceIdsByModifierId),
        [menuItem, selectedChoiceIdsByModifierId]
    );

    const isOrderValid = useIsOrderValid(menuItem, getSelectedChoiceIdsForModifier);

    const onAddToCartClicked = () => {
        if (!isOrderValid) {
            return;
        }

        const newCartItem: ICartItemWithMetadata = {
            id:                  fromCartItem?.id ?? getRandomId(),
            associatedItem:      menuItem,
            itemId:              menuItem.id,
            quantity:            quantity,
            price:               totalPrice,
            specialInstructions: notes,
            choicesByModifierId: selectedChoiceIdsByModifierId,
            cafeId
        };

        const newCart = shallowCloneCart(cartItemsNotifier.value);
        addOrEditCartItem(newCart, newCartItem);
        cartItemsNotifier.value = newCart;

        closeModal();
    };

    const onAddQuantityClicked = () => {
        setQuantity(quantity + 1);
    };

    const onRemoveQuantityClicked = () => {
        if (quantity <= 1) {
            return;
        }

        setQuantity(quantity - 1);
    };

    const onSearchClicked = () => {
        navigateToSearch(navigate, menuItem.name);
        closeModal();
    };

    const copyToClipboard = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch {
            return false;
        }
    };

    const onCopyClicked = () => {
        const cafeView = viewsById.get(cafeId);

        if (cafeView == null) {
            console.error('Could not get cafe view for cafe id', cafeId);
            return;
        }

        const parentView = getParentView(viewsById, cafeView, shouldUseGroups);

        const viewPath = getViewMenuUrlWithJump({
            cafeId,
            view:       parentView,
            name:       menuItem.name,
            entityType: SearchEntityType.menuItem,
            date:       selectedDateNotifier.value
        });

        copyToClipboard(`${window.location.origin}${viewPath}`)
            .then((didSucceed) => {
                const backgroundColor = didSucceed
                    ? '#66BB6A'
                    : '#EF5350';
                setCopyButtonBackground(backgroundColor);
                setTimeout(() => setCopyButtonBackground(undefined), 1000);
            });
    };

    return (
        <Modal
            title={`${isUpdate ? 'Edit ' : ''}${menuItem.name}`}
            buttons={
                <>
                    <FavoriteItemButton name={menuItem.name} type={SearchEntityType.menuItem}/>
                    <button title="Click to copy link" onClick={onCopyClicked}>
                        <span className="material-symbols-outlined" style={{ background: copyButtonBackground }}>
                            link
                        </span>
                    </button>
                    <button title="Search for this item across campus" onClick={onSearchClicked}>
                        <span className="material-symbols-outlined">
							search
                        </span>
                    </button>
                </>
            }
            body={(
                <MenuItemPopupBody
                    menuItem={menuItem}
                    notes={notes}
                    getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                    onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                    onNotesChanged={setNotes}
                />
            )}
            footer={(
                <MenuItemPopupFooter
                    isUpdate={isUpdate}
                    totalPrice={totalPrice}
                    quantity={quantity}
                    isOrderValid={isOrderValid}
                    onAddToCartClicked={onAddToCartClicked}
                    onAddQuantityClicked={onAddQuantityClicked}
                    onRemoveQuantityClicked={onRemoveQuantityClicked}
                />
            )}
        />
    );
};