import { useIsAdmin } from '../../../hooks/auth.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { DebugSettings } from '../../../constants/settings.ts';

const SYNTHESIS_FLAG_SETTINGS = [
    { setting: DebugSettings.synthesizeConceptSchedule, label: 'Concept Schedule' },
    { setting: DebugSettings.synthesizeOrderingContext, label: 'Ordering Context' },
    { setting: DebugSettings.synthesizePayConfig,       label: 'Pay Config' },
    { setting: DebugSettings.synthesizeKioskItems,      label: 'Kiosk Items' },
] as const;

export const SynthesisFlagsPanel = () => {
    const isAdmin = useIsAdmin();

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="card flex-col" style={{ gap: '0.5rem' }}>
            <div className="title" style={{ fontSize: '0.85rem' }}>
                🧪 Synthesis Flags
            </div>
            <div className="flex" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                {SYNTHESIS_FLAG_SETTINGS.map(({ setting, label }) => (
                    <SynthesisFlagCheckbox key={setting.name} setting={setting} label={label}/>
                ))}
            </div>
        </div>
    );
};

const SynthesisFlagCheckbox = ({ setting, label }: { setting: typeof DebugSettings.synthesizeConceptSchedule; label: string }) => {
    const value = useValueNotifier(setting) === true;

    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
                type="checkbox"
                checked={value}
                onChange={() => setting.value = !value}
            />
            {label}
        </label>
    );
};
