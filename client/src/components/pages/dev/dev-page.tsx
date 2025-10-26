import { useRequireRole } from '../../../hooks/auth.js';
import { classNames } from '../../../util/react.js';
import React, { useState } from 'react';
import { ForceRefreshMenu } from './force-refresh-menu.js';

const tabs = {
    'Refresh Menu': <ForceRefreshMenu/>,
    'Groups': <div>todo</div>
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
                <div className="dev-page-tabs flex flex-col">
                    {
                        tabNames.map(tabName => (
                            <button
                                key={tabName}
                                className={classNames(
                                    'dev-page-tab default-button default-container',
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