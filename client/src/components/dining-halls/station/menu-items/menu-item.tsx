import React, { useContext, useState } from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
import { SettingsContext } from '../../../../context/settings.ts';
import { DiningClient } from '../../../../api/dining.ts';

//import imageSvg from '../../../../assets/image.svg';

export interface IMenuItemProps {
    menuItem: IMenuItem;
}

const getCaloriesDisplay = (menuItem: IMenuItem) => {
    if (!menuItem.calories) {
        return false;
    }

    const parts = [menuItem.calories];
    if (menuItem.maxCalories) {
        parts.push(menuItem.maxCalories);
    }

    return `${parts.join('-')} Calories`;
};

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const [{ showImages, showCalories, showDescriptions }] = useContext(SettingsContext);
    const caloriesDisplay = getCaloriesDisplay(menuItem);
    const thumbnailUrl = DiningClient.getThumbnailUrlForMenuItem(menuItem);
    const [forceFullImage, setForceFullImage] = useState(false);
    const canShowImage = thumbnailUrl != null || (forceFullImage && menuItem.imageUrl != null);

    return (
        <tr>
            <td colSpan={showImages && !canShowImage ? 2 : 1}>
                <div className="menu-item-head">
                    <span className="menu-item-name">{menuItem.displayName}</span>
                    {
                        showDescriptions
                            && menuItem.description
                            && <span className="menu-item-description">{menuItem.description}</span>
                    }
                </div>
            </td>
            {
                // Always show this <td> when images are enabled, even if there is no image url, in order to keep the same column count across rows
                showImages && (
                    <td className="centered-content">
                        {
                            canShowImage && (
                                <img src={forceFullImage ? menuItem.imageUrl : thumbnailUrl}
                                     decoding="async"
                                     alt="Menu item image"
                                     className="menu-item-image"
                                     loading="lazy"
                                     onError={() => setForceFullImage(true)}/>
                            )
                        }
                    </td>
                )
            }
            <td>
                ${menuItem.price}
            </td>
            {
                showCalories && (
                    <td>
                        {caloriesDisplay}
                    </td>
                )
            }
        </tr>
    );
};