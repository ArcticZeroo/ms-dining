import './auth.css';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { ApplicationContext } from '../../context/app.ts';

export const AuthInfo = () => {
    const { isLoggedIn } = useContext(ApplicationContext);

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
}