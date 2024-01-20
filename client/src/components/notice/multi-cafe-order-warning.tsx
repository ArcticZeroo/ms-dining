import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { useState } from 'react';

export const MultiCafeOrderWarning = () => {
    const isPermanentlySuppressed = useValueNotifier(ApplicationSettings.suppressMultiCafeOrderWarning);
    const [isTemporarilySuppressed, setIsTemporarilySuppressed] = useState(false);

    const onTemporarilySuppressClicked = () => {
        setIsTemporarilySuppressed(true);
    }

    const onPermanentlySuppressClicked = () => {
        ApplicationSettings.suppressMultiCafeOrderWarning.value = true;
    }

    const shouldShowNotification = !isPermanentlySuppressed && !isTemporarilySuppressed;

    if (!shouldShowNotification) {
        return null;
    }

    return (
        <div className="card notice visible yellow">
            Warning: Your order contains items from multiple cafes.
            <ul className="left-align">
                <li>
                    It will take much longer to process your order.
                </li>
                <li>
                    It is possible that your order is accepted by one cafe but rejected by another. Accepted orders cannot be cancelled, so you must still pick them up.
                </li>
                <li>
                    You may have to pick up your order from different buildings, depending on the cafes you've chosen.
                </li>
            </ul>
            <div className="flex">
                <button className="default-container" onClick={onTemporarilySuppressClicked}>
                    I understand, close for now
                </button>
                <button className="default-container" onClick={onPermanentlySuppressClicked}>
                    Don't show this again
                </button>
            </div>
        </div>
    );
}