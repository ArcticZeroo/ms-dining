import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { MenuSettings } from '../../settings/menu-settings.tsx';
import { OtherSettings } from '../../settings/other-settings.tsx';
import { SearchSettings } from '../../settings/search-settings.tsx';
import { usePageData } from '../../../hooks/location.ts';
import './settings.css';

export const SettingsPage = () => {
    usePageData('Settings', 'Customize your settings for the app');

    return (
        <div id="settings">
            <HomepageSettings requireButtonToCommitHomepageViews={false}/>
            <MenuSettings/>
            <SearchSettings/>
            <OtherSettings/>
        </div>
    );
};