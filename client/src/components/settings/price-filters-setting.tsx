import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { NumberSettingInput } from './number-setting-input.tsx';
import { useValueNotifier } from '../../hooks/events.ts';

export const PriceFiltersSetting = () => {
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    return (
        <div className="setting" id="setting-price-filters">
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