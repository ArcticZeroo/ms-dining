import { Link } from 'react-router-dom';
import { useIsLoggedIn } from '../../hooks/auth.ts';

export const LogInForReviewButton = () => {
    const isLoggedIn = useIsLoggedIn();

    if (isLoggedIn) {
        return null;
    }

    return (
        <Link to="/login" className="default-button default-container flex flex-center">
            Log in to leave a review
        </Link>
    );
};