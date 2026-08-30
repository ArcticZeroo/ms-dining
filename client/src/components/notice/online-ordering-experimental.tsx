import { useValueNotifier } from '../../hooks/events.ts';
import { DebugSettings } from '../../constants/settings.ts';

export const OnlineOrderingExperimental = () => {
    const isSuppressed = useValueNotifier(DebugSettings.suppressExperimentalOnlineOrderingWarning);

    if (isSuppressed) {
        return null;
    }

    return (
        <div className="card notice visible flex-col">
            <p>
                Online ordering is an experimental feature, so something on this site might
                occasionally go wrong. Two things worth knowing if it does:
            </p>
            <ul className="left-align">
                <li>Your card is only charged if the order actually makes it to the cafe's kitchen.</li>
                <li>You'll get a text confirmation once the order is placed — even if this site shows an error.</li>
            </ul>
            <p>
                If something looks off, it's safe to try again. Questions or feedback are always welcome!
            </p>
            <div className="flex">
                <a href="mailto:spnovick@microsoft.com" target="_blank">Email Me</a>
                <a href="https://teams.microsoft.com/l/chat/0/0?users=spnovick@microsoft.com" target="_blank">Send me a Teams Message</a>
            </div>
        </div>
    );
}