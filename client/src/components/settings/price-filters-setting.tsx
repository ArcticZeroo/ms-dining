import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { NumberSettingInput } from './number-setting-input.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { useEffect, useRef } from 'react';

export const PriceFiltersSetting = () => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);
    const settingRef = useRef<HTMLDivElement>(null);

    // Changing price filter settings can cause a huge amount of scroll jumping due to added/removed rows in tables.
    // We should scroll to the price filter setting each time we change any of the price filter settings.
    useEffect(() => {
        settingRef.current?.scrollIntoView({ behavior: 'instant' });
    }, [enablePriceFilters, minPrice, maxPrice]);

    return (
        <div className="setting" id="setting-price-filters" ref={settingRef}>
            <div className="setting-info">
                <div className="setting-name">
                    <span className="material-symbols-outlined">
						attach_money
                    </span>
                    Price Filters
                </div>
                <div className="setting-description">
                    Optionally filter out menu items that are outside of your price range.
                </div>
            </div>
            <div className="flex flex-wrap">
                <BooleanSettingInput
                    icon="money_off"
                    setting={ApplicationSettings.enablePriceFilters}
                    name="Enable Price Filters"
                    isChip={true}
                />
                <NumberSettingInput
                    name="Minimum Price ($)"
                    setting={ApplicationSettings.minimumPrice}
                    requiredSettings={[ApplicationSettings.enablePriceFilters]}
                    min={0}
                    max={maxPrice}
                    step={0.01}
                />
                <NumberSettingInput
                    name="Maximum Price ($)"
                    setting={ApplicationSettings.maximumPrice}
                    requiredSettings={[ApplicationSettings.enablePriceFilters]}
                    min={minPrice}
                    max={30}
                    step={0.01}
                />
            </div>
        </div>
    );
};