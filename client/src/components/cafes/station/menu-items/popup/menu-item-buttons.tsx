import { IMenuItem } from '@msdining/common/dist/models/cafe';
import { FavoriteItemButton } from '../../../../button/favorite-item-button.tsx';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useContext, useState } from 'react';
import { navigateToSearch } from '../../../../../util/search.ts';
import { getParentView } from '../../../../../util/view.ts';
import { getViewMenuUrlWithJump } from '../../../../../util/link.ts';
import { useNavigate } from 'react-router-dom';
import { ApplicationContext } from '../../../../../context/app.ts';
import { useValueNotifier } from '../../../../../hooks/events.ts';
import { ApplicationSettings } from '../../../../../constants/settings.ts';
import { SelectedDateContext } from '../../../../../context/time.ts';

interface IMenuItemButtonsProps {
	cafeId: string;
	menuItem: IMenuItem;
    onClose?: () => void;
}

export const MenuItemButtons: React.FC<IMenuItemButtonsProps> = ({ cafeId, menuItem, onClose }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const selectedDateNotifier = useContext(SelectedDateContext);
    const navigate = useNavigate();

    const [copyButtonBackground, setCopyButtonBackground] = useState<string | undefined>(undefined);

    const onSearchClicked = (event: React.MouseEvent) => {
        // Don't open the modal if this is in a menu item
        event.preventDefault();
        event.stopPropagation();

        navigateToSearch(navigate, menuItem.name);
        onClose?.();
    };

    const copyToClipboard = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch {
            return false;
        }
    };

    const onCopyClicked = (event: React.MouseEvent) => {
        // Don't open the modal if this is in a menu item
        event.preventDefault();
        event.stopPropagation();

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
        <>
            <FavoriteItemButton name={menuItem.name} type={SearchEntityType.menuItem}/>
            <button title="Click to copy link" onClick={onCopyClicked} className="copy-button flex flex-justify-center">
                <span className="material-symbols-outlined transition-background" style={{ background: copyButtonBackground }}>
                    link
                </span>
            </button>
            <button title="Search for this item across campus" onClick={onSearchClicked} className="flex flex-justify-center">
                <span className="material-symbols-outlined">
                    search
                </span>
            </button>
        </>
    )
}