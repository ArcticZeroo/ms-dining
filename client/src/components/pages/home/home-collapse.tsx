import React, { useState } from 'react';
import { classNames } from '../../../util/react.ts';
import { ExpandIcon } from '../../icon/expand.tsx';
import { BooleanSetting } from "../../../api/settings.ts";

interface IHomeCollapseProps {
    title: string;
    children?: React.ReactNode;
    featureToggle?: BooleanSetting;
    id?: string;
}

export const HomeCollapse: React.FC<IHomeCollapseProps> = ({ title, children, featureToggle, id }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const onToggleExpansion = () => setIsCollapsed(!isCollapsed);

    const onRemoveClicked = (event: React.MouseEvent) => {
        if (featureToggle) {
            event.preventDefault();
            featureToggle.value = false;
        }
    }

    return (
        <div className={classNames('collapsible-content flex-col', isCollapsed && 'collapsed')} id={id}>
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                {/*always need three spans to ensure centering of the middle even if there is no close button on the left*/}
                <span>
                    {
                        featureToggle && (
                            <button title="Click to remove this feature from your home page. You can re-add from settings." className="flex remove-button"
                                onClick={onRemoveClicked}>
                                <span className="material-symbols-outlined">
                                close
                                </span>
                            </button>
                        )
                    }
                </span>
                <span className="flex">
                    <span>
                        {title}
                    </span>
                    <ExpandIcon isExpanded={!isCollapsed}/>
                </span>
                <span/>
            </div>
            <div className="collapse-body">
                {children}
            </div>
        </div>
    );
};