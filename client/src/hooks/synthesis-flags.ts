import { useIsAdmin } from './auth.ts';
import { useValueNotifier } from './events.ts';
import { DebugSettings } from '../constants/settings.ts';
import type { ISynthesisFlags } from '../api/ordering.ts';

export const useSynthesisFlags = (): ISynthesisFlags | undefined => {
    const isAdmin = useIsAdmin();
    const conceptSchedule = useValueNotifier(DebugSettings.synthesizeConceptSchedule) === true;
    const orderingContext = useValueNotifier(DebugSettings.synthesizeOrderingContext) === true;
    const payConfig = useValueNotifier(DebugSettings.synthesizePayConfig) === true;
    const kioskItems = useValueNotifier(DebugSettings.synthesizeKioskItems) === true;

    if (!isAdmin) {
        return undefined;
    }

    return { conceptSchedule, orderingContext, payConfig, kioskItems };
};
