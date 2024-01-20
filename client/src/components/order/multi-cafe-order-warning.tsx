export const MultiCafeOrderWarning = () => {
    return (
        <div className="error-card">
            Warning: Your order contains items from multiple cafes.
            <ul className="left-align">
                <li>
                    It will take much longer to process your order.
                </li>
                <li>
                    It is possible that your order is accepted by one cafe but rejected by another. Accepted orders cannot be cancelled, so you must still pick them up.
                </li>
                <li>
                    You may have to pick up your order from different buildings, depending on the cafes you've chosen.
                </li>
            </ul>
        </div>
    );
}