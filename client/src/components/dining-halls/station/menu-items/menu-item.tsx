import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { knownTags } from '../../../../constants/tags.tsx';
import { PopupContext } from '../../../../context/modal.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { IMenuItem } from '../../../../models/cafe.ts';
import { getPriceDisplay } from '../../../../util/cart.ts';
import { MenuItemImage } from './menu-item-image.tsx';
import { MenuItemTags } from './menu-item-tags.tsx';
import { MenuItemOrderPopup } from './order/menu-item-order-popup.tsx';

export interface IMenuItemProps {
	menuItem: IMenuItem;
}

const getCaloriesDisplay = (menuItem: IMenuItem) => {
	if (!menuItem.calories || Number(menuItem.calories) < 1) {
		return false;
	}

	const parts = [menuItem.calories];
	if (menuItem.maxCalories && Number(menuItem.maxCalories) > 0) {
		parts.push(menuItem.maxCalories);
	}

	return `${parts.join('-')} Calories`;
};

const menuItemModalSymbol = Symbol('menuItem');

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
	const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
	const showImages = useValueNotifier(ApplicationSettings.showImages);
	const showCalories = useValueNotifier(ApplicationSettings.showCalories);
	const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
	const showTags = useValueNotifier(ApplicationSettings.showTags);
	const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);
	const caloriesDisplay = getCaloriesDisplay(menuItem);

	const modalNotifier = useContext(PopupContext);

	const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

	const onOpenModalClick = () => {
		if (!allowOnlineOrdering) {
			return;
		}

		// There's already a modal active.
		if (modalNotifier.value != null) {
			return;
		}

		modalNotifier.value = {
			id:   menuItemModalSymbol,
			body: <MenuItemOrderPopup menuItem={menuItem} modalSymbol={menuItemModalSymbol}/>,
		};
	};

	const currentHighlightTag = useMemo(() => {
		for (const tagName of menuItem.tags) {
			if (highlightTagNames.has(tagName)) {
				return knownTags[tagName];
			}
		}
	}, [highlightTagNames, menuItem.tags]);

	return (
		<tr style={{ backgroundColor: currentHighlightTag?.color }}>
			<td>
				<div className="menu-item-buttons default-gap">
					<Link to={`/search?q=${encodeURIComponent(menuItem.name)}`} className="link-button" title="Search for this item">
						<span className="material-symbols-outlined">
							search
						</span>
					</Link>
					{
						allowOnlineOrdering && (
												<button className="link-button" title="Add to cart" onClick={onOpenModalClick}>
													<span className="material-symbols-outlined">
														add_shopping_cart
													</span>
												</button>
											)
					}
				</div>
			</td>
			<td colSpan={!canShowImage ? 2 : 1}>
				<div className="menu-item-head">
					<span className="menu-item-name">{menuItem.name}</span>
					{
						showDescriptions
						&& menuItem.description
						&& <span className="menu-item-description">{menuItem.description}</span>
					}
				</div>
			</td>
			{
				canShowImage && (
								 <td className="centered-content">
									 <MenuItemImage menuItem={menuItem}/>
								 </td>
							 )
			}
			<td>
				{getPriceDisplay(menuItem.price)}
			</td>
			{
				showCalories && (
								 <td>
									 {caloriesDisplay}
								 </td>
							 )
			}
			{
				showTags && (
							 <td>
								 <MenuItemTags tags={menuItem.tags}/>
							 </td>
						 )
			}
		</tr>
	);
};