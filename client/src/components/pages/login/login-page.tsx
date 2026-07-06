import { useLoginPageAccess } from '../../../hooks/login-page.ts';
import { LoginBenefitsCard } from './login-benefits-card.tsx';
import { LoginCard } from './login-card.tsx';

import './login-page.css';

export const LoginPage = () => {
    const isPageAllowed = useLoginPageAccess();

    if (!isPageAllowed) {
        return null;
    }

    return (
        <div className="flex-col flex-center">
            <LoginCard/>
            <LoginBenefitsCard/>
        </div>
    );
};