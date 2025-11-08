import { useValueNotifier } from '../../hooks/events.js';
import { ApplicationSettings } from '../../constants/settings.js';

export const CampusMapClickTip = () => {
    const isHidden = useValueNotifier(ApplicationSettings.hasHiddenMapClickTip);

    if (isHidden) {
        return null;
    }

    const onDismissClicked = () => {
        ApplicationSettings.hasHiddenMapClickTip.value = true;
    };

    return (
        <div className="flex flex-center">
            <div className="flex tip default-container">
                <span className="subtitle">
                    Tip: Click on cafes in the map to see what's new, traveling, and interesting for the day's menu.
                </span>
                <button
                    className="default-button no-bg material-symbols-outlined"
                    onClick={onDismissClicked}
                    title="Close tip"
                >
                    close
                </button>
            </div>
        </div>
    );
};