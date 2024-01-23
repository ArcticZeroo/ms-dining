import { Link } from 'react-router-dom';

export const EmptyCartNotice = () => {
    return (
        <div className="card dark-blue flex">
            You must add items to your cart before checking out.
            <Link to="/" className="default-container default-button flex" title="Click to go home">
                <span className="material-symbols-outlined">
                    home
                </span>
                <span>
                    Go Home
                </span>
            </Link>
        </div>
    );
};