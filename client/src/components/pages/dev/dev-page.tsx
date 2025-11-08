import { useRequireRole } from '../../../hooks/auth.js';
import { classNames } from '../../../util/react.js';
import React, { useContext, useState } from 'react';
import { ForceRefreshMenu } from './force-refresh-menu.js';
import { GroupList } from './groups/group-list.js';
import { GroupZeroContextCandidateList } from './groups/group-zero-context-candidate-list.js';
import { ScrollTopContext } from '../../../context/scroll.js';
import './dev-page.css';

const tabs = {
    'Refresh Menu': <ForceRefreshMenu/>,
    'Group List': <GroupList/>,
    'Suggested Groups': <GroupZeroContextCandidateList/>
} satisfies Record<string, React.ReactNode>;

type TabName = keyof typeof tabs;

const tabNames = Object.keys(tabs) as TabName[];

export const DevPage = () => {
    useRequireRole('admin');

    const [currentTab, setCurrentTab] = useState<TabName>('Refresh Menu');
    const scrollToTop = useContext(ScrollTopContext);

    const onTabChange = (tabName: TabName) => {
        setCurrentTab(tabName);
        scrollToTop();
    }

    return (
        <div className="card" id="dev-page">
            <div className="flex sticky-header bg-card-background">
                <div className="title">
                    Dev Settings
                </div>
                <div className="tab-selector flex">
                    {
                        tabNames.map(tabName => (
                            <button
                                key={tabName}
                                className={classNames(
                                    'tab-option default-button default-container self-stretch',
                                    currentTab === tabName && 'active'
                                )}
                                onClick={() => onTabChange(tabName)}
                            >
                                {tabName}
                            </button>
                        ))
                    }
                </div>
            </div>
            <div className="flex height-100">
                <div className="dev-page-tab-content">
                    {tabs[currentTab]}
                </div>
            </div>
        </div>
    );
};