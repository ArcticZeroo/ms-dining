import { useLocation } from 'react-router-dom';

export const useLocationHash = () => {
    const location = useLocation();
    return location.hash;
}