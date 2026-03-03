import React, { JSX } from 'react';
import { classNames } from '../../util/react.js';

export interface ITabOption {
    name: string;
    id: string;
}

export interface ITabViewProps {
    options: ITabOption[];
    selectedTabId: string;
    onTabIdChanged(tabId: string): void;
    renderTab: (tabId: string) => JSX.Element;
    loadingTabCount?: number;
}

export const TabView: React.FC<ITabViewProps> = ({ options, renderTab, selectedTabId, onTabIdChanged, loadingTabCount = 0 }) => {
    if (options.length === 0 && loadingTabCount === 0) {
        throw new Error('TabView must have >0 options.');
    }

    return (
        <div className="flex-col">
            <div className="flex flex-wrap tab-selector">
                {
                    options.map((option) => (
                        <button className={classNames('tab-option', option.id === selectedTabId && 'active')} key={option.id} onClick={() => onTabIdChanged(option.id)}>
                            {option.name}
                        </button>
                    ))
                }
                {
                    Array.from({ length: loadingTabCount }, (_, index) => (
                        <button className="tab-option loading-skeleton" key={`loading-${index}`} disabled>
                            ...
                        </button>
                    ))
                }
            </div>
            {options.length > 0 && <React.Fragment key={selectedTabId}>{renderTab(selectedTabId)}</React.Fragment>}
        </div>
    );
}