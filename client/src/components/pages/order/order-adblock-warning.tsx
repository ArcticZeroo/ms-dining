// the buy-ondemand payment popup does not work with adblock enabled. try to detect if it is enabled and show a warning.
export const OrderAdblockWarning = () => {
    if ('showOnlineOrderingAdblockWarning' in window && window.showOnlineOrderingAdblockWarning === false) {
        return;
    }

    return (
        <div className="card notice visible yellow">
            You appear to have adblock enabled. You may need to turn it off for the ordering popup to cooperate.
        </div>
    );
}