import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export const useRemoveSource = () => {
    const location = useLocation();

    useEffect(
        () => {
            const searchParams = new URLSearchParams(location.search);
            if (!searchParams.has('source')) {
                return;
            }

            searchParams.delete('source');

            const newSearch = searchParams.toString();

            window.history.replaceState(
                {},
                '',
                `${location.pathname}${newSearch ? `?${newSearch}` : ''}`
            );
        }
    )
};