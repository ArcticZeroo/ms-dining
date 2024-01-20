export const OnlineOrderingExperimental = () => {
    return (
        <div className="error-card notice visible">
            Warning: Online ordering is extremely experimental. Any or all of the following might occur:
            <ul className="left-align">
                <li>Your credit card might be charged multiple times</li>
                <li>Your credit card might be charged but the order might not make it to the cafe</li>
                <li>The cafe receives incorrect order information (or none at all)</li>
            </ul>
        </div>
    );
}