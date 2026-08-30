export type PayBlockReason = 'invalid-identity' | 'unavailable-items' | 'other-payment-active';

export interface IPayAvailability {
    canPay: boolean;
    blockReason: PayBlockReason | null;
}

interface IDerivePayAvailabilityParams {
    isReadyToPay: boolean;
    isIdentityValid: boolean;
    hasUnavailableItems: boolean;
    isOtherPaymentActive: boolean;
}

/**
 * Single source of truth for "can this cafe pay right now, and if not, why".
 * Reason priority matches the order we surface to the user.
 */
export const derivePayAvailability = ({
    isReadyToPay,
    isIdentityValid,
    hasUnavailableItems,
    isOtherPaymentActive,
}: IDerivePayAvailabilityParams): IPayAvailability => {
    if (hasUnavailableItems) {
        return { canPay: false, blockReason: 'unavailable-items' };
    }

    if (!isIdentityValid) {
        return { canPay: false, blockReason: 'invalid-identity' };
    }

    if (isOtherPaymentActive) {
        return { canPay: false, blockReason: 'other-payment-active' };
    }

    return { canPay: isReadyToPay, blockReason: null };
};
