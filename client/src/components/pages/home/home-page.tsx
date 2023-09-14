import { useContext } from 'react';
import { SettingsContext } from '../../../context/settings.ts';
import { Link } from 'react-router-dom';
import { CombinedDiningHallMenuList } from '../../dining-halls/combined-dining-hall-menu-list.tsx';

import './home.css';

export const HomePage = () => {
    const [{ homepageDiningHallIds }] = useContext(SettingsContext);

    if (homepageDiningHallIds.size === 0) {
        return (
            <div className="centered-content">
                <div className="card centered">
                    <div className="title">
                        Microsoft Cafeteria Menus Home
                    </div>
                </div>
                <Link to={'/settings'} id="home-settings">
                    <div className="card centered blue">
                        <div className="title">
                            Head to the settings page in order to select homepage dining halls!
                        </div>
                    </div>
                </Link>
            </div>
        );
    }

    return (
        <CombinedDiningHallMenuList diningHallIds={homepageDiningHallIds}/>
    );
};