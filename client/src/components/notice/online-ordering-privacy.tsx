import { useValueNotifierAsState } from '../../hooks/events.js';
import { InternalSettings } from '../../constants/settings.js';

export const OnlineOrderingPrivacy = () => {
    const [isSuppressed, setIsSuppressed] = useValueNotifierAsState(InternalSettings.suppressOrderPrivacyPolicy);
    if (isSuppressed) {
        return null;
    }

    return (
        <div className="card notice visible">
            <span>
                Your payment information is never stored by this website. From all information on this checkout page, only the order contents are stored.
            </span>
            <span>
                By clicking "Pay" you agree to the privacy and data collection policies of the 3rd-party services handling your order. These services likely store some payment information.
            </span>
            <div className="flex-center">
                <button className="default-button default-container" onClick={() => setIsSuppressed(true)}>
                    Understood, Don't Show Again
                </button>
            </div>
        </div>
    );
}