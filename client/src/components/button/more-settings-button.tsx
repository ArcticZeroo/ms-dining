import { Link } from 'react-router-dom';

export const MoreSettingsButton = () => (
    <div className="centered-content">
        <Link className="default-container flex default-button" to="/settings">
            <span className="material-symbols-outlined">
                settings
            </span>
            <span>
                More Settings
            </span>
        </Link>
    </div>
);