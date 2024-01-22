export const OnlineOrderingExperimental = () => {
    return (
        <div className="error-card notice visible">
            <p>
                Warning: Online ordering is extremely experimental. Any or all of the following might occur:
                <ul className="left-align">
                    <li>Your credit card might be charged multiple times</li>
                    <li>Your credit card might be charged but the order might not make it to the cafe</li>
                    <li>The cafe receives incorrect order information (or none at all)</li>
                </ul>
                You probably shouldn't even use this feature while this warning exists!
                <br/>
                That said... please let me know whether your order went well (or not) so I can improve this feature.
            </p>
            <div className="flex">
                <a href="mailto:spnovick@microsoft.com" target="_blank">Email Me</a>
                <a href="https://teams.microsoft.com/l/chat/0/0?users=spnovick@microsoft.com" target="_blank">Send me a Teams Message</a>
            </div>
        </div>
    );
}