import { ApplicationSettings } from '../../api/settings.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { HighlightTagsSetting } from './highlight-tags-setting.tsx';
import { PriceFiltersSetting } from './price-filters-setting.tsx';
export const MenuSettings = () => (
    <div className="card settings-group">
        <div className="title">
			Menu Settings
        </div>
        <div className="body">
            <div className="setting" id="setting-display">
                <div className="setting-info">
                    <div className="setting-name">
                        <span className="material-symbols-outlined">
                                visibility
                        </span>
						Display Settings
                    </div>
                    <div className="setting-description">
						Select the information that you want to appear on cafe menus, search, and headers.
                    </div>
                </div>
                <div className="setting-chips">
                    <BooleanSettingInput
                        icon="photo_camera"
                        setting={ApplicationSettings.showImages}
                        name="Show Images"
                        isChip={true}
                    />
                    <BooleanSettingInput
                        icon="local_fire_department"
                        setting={ApplicationSettings.showCalories}
                        name="Show Calories"
                        isChip={true}
                    />
                    <BooleanSettingInput
                        icon="edit"
                        setting={ApplicationSettings.showDescriptions}
                        name="Show Descriptions"
                        isChip={true}
                    />
                    <BooleanSettingInput
                        icon="book"
                        setting={ApplicationSettings.showTags}
                        name="Show Tags"
                        isChip={true}
                    />
                </div>
            </div>
            <HighlightTagsSetting/>
            <PriceFiltersSetting/>
            <BooleanSettingInput
                icon="lightbulb"
                setting={ApplicationSettings.intelligentStationSort}
                name="Intelligent Station Sorting"
                description="When enabled, stations will be sorted intelligently, based on factors like uniqueness."
            />
            <BooleanSettingInput
                icon="list"
                setting={ApplicationSettings.hideEveryDayStations}
                name="Hide Every-Day Stations"
                description="When enabled, stations which appear on the menu at this cafe every day of the week will be hidden."
            />
            <BooleanSettingInput
                icon="expand_content"
                setting={ApplicationSettings.collapseCafesByDefault}
                name="Collapse Cafes by Default"
                description="When enabled, cafes will be collapsed by default in the menu."
            />
            <BooleanSettingInput
                icon="expand_content"
                setting={ApplicationSettings.collapseStationsByDefault}
                name="Collapse Stations by Default"
                description="When enabled, stations within cafes will be collapsed by default in the menu."
            />
            <BooleanSettingInput
                icon="schedule"
                setting={ApplicationSettings.allowFutureMenus}
                name="(Experimental) Allow Future Menus"
                description={
                    <>
						When enabled, a date picker will be shown on cafe pages, and you can see future menu
						information in search.
                        <br/>
						Menus are known to change frequently before online ordering is actually available!
						In some cases, menus have changed as late as 9am on the day that they are available.
                    </>
                }
            />
        </div>
    </div>
)