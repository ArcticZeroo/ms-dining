import './auth.css';
import { Link } from 'react-router-dom';
import { useIsLoggedIn } from '../../hooks/auth.ts';

export const AuthInfo = () => {
    const isLoggedIn = useIsLoggedIn();

    if (!isLoggedIn) {
        return (
            <Link to="/login">
                Login
            </Link>
        );
    }

    return (
        <Link className="auth-info" to="/profile">
            My Profile
        </Link>
    );
};