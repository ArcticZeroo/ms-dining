import { useRequireRole } from '../../../hooks/auth.js';
import { classNames } from '../../../util/react.js';
import React, { useState } from 'react';
import { ForceRefreshMenu } from './force-refresh-menu.js';
import { GroupsView } from './groups/groups-view.js';

const tabs = {
    'Refresh Menu': <ForceRefreshMenu/>,
    'Groups': <GroupsView/>
} satisfies Record<string, React.ReactNode>;

type TabName = keyof typeof tabs;

const tabNames = Object.keys(tabs) as TabName[];

export const DevPage = () => {
    useRequireRole('admin');

    const [currentTab, setCurrentTab] = useState<TabName>('Refresh Menu');

    return (
        <div className="card" id="dev-page">
            <div className="title">
                Dev Settings
            </div>
            <div className="flex">
                <div className="tab-selector flex-col flex-start">
                    {
                        tabNames.map(tabName => (
                            <button
                                key={tabName}
                                className={classNames(
                                    'tab-option default-button default-container self-stretch',
                                    currentTab === tabName && 'active'
                                )}
                                onClick={() => setCurrentTab(tabName)}
                            >
                                {tabName}
                            </button>
                        ))
                    }
                </div>
                <div className="dev-page-tab-content">
                    {tabs[currentTab]}
                </div>
            </div>
        </div>
    );
};