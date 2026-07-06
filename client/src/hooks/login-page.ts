import { useRequireLoginStatus } from './auth.ts';
import { usePageData } from './location.ts';

export const useLoginPageAccess = () => {
    const isPageAllowed = useRequireLoginStatus(false, '/profile');
    usePageData('Log In', 'Log into an account for more features.');

    return isPageAllowed;
};
