import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

export const OnlineOrderingExperimental = () => {
    const isSuppressed = useValueNotifier(ApplicationSettings.suppressExperimentalOnlineOrderingWarning);

    if (isSuppressed) {
        return null;
    }

    return (
        <div className="card notice visible flash">
            <p>
                Warning: Online ordering is extremely experimental. Any or all of the following might occur:
                <ul className="left-align">
                    <li>The cafe might be closed when you arrive (this app does not use cafe schedules)</li>
                    <li>Your credit card might be charged multiple times</li>
                    <li>Your credit card might be charged but the order might not make it to the cafe</li>
                    <li>The cafe receives incorrect order information (or none at all)</li>
                </ul>
                You probably shouldn't even use this feature while this warning exists!
                <br/>
                If you ignore this warning, you are ordering at your own risk.
                <br/>
                If you have any questions or feedback, please contact me.
            </p>
            <div className="flex">
                <a href="mailto:spnovick@microsoft.com" target="_blank">Email Me</a>
                <a href="https://teams.microsoft.com/l/chat/0/0?users=spnovick@microsoft.com" target="_blank">Send me a Teams Message</a>
            </div>
        </div>
    );
}