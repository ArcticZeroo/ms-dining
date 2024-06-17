import React, { useContext, useMemo, useState } from "react";
import { ApplicationContext } from "../../../context/app.ts";
import { classNames } from "../../../util/react.ts";
import { getScenarios, IScenario } from "../../../util/analytics.ts";
import { Dropdown } from "../../dropdown/dropdown.tsx";

interface IScenarioDropdownProps {
    selectedScenario: IScenario;
    onScenarioChange: (scenario: IScenario) => void;
}

export const ScenarioDropdown: React.FC<IScenarioDropdownProps> = ({ selectedScenario, onScenarioChange }) => {
    const { cafes } = useContext(ApplicationContext);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const scenarios = useMemo(
        () => getScenarios(cafes),
        [cafes]
    );

    const onOpenDropdown = (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    }

    const onScenarioOptionClicked = (scenario: IScenario) => {
        setIsDropdownOpen(false);
        onScenarioChange(scenario);
    }

    return (
        <div className="scenarios">
            <button
                onClick={onOpenDropdown}
                className="open-dropdown default-container flex"
            >
                Scenario: {selectedScenario.label}
            </button>
            {
                isDropdownOpen && (
                    <Dropdown onClose={() => setIsDropdownOpen(false)}>
                        <div className="flex flex-wrap flex-items-stretch">
                            {
                                scenarios.map(scenario => (
                                    <button
                                        className={classNames('scenario default-container', selectedScenario.scenarioName === scenario.scenarioName && 'selected')}
                                        key={scenario.label}
                                        onClick={() => onScenarioOptionClicked(scenario)}
                                    >
                                        {scenario.label}
                                    </button>
                                ))
                            }
                        </div>
                    </Dropdown>
                )
            }
        </div>
    );
}