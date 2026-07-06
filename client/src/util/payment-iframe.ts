import { IPaymentCardInfo } from '@msdining/common/models/cart';
import { z } from 'zod';

export interface IPaymentSuccessResult {
    token: string;
    cardInfo: IPaymentCardInfo;
}

const FrameCardInfoSchema = z.object({
    cardIssuer:          z.string(),
    accountNumberMasked: z.string(),
    expirationYearMonth: z.string(),
    cardholderName:      z.string(),
    postalCode:          z.string(),
}).passthrough();

const FrameCompletionMessageSchema = z.object({
    token:                    z.string().optional(),
    transactionReferenceData: z.object({
        token: z.string(),
    }).optional(),
    cardInfo:                 FrameCardInfoSchema.optional(),
    gatewayResponseData:      z.object({
        decision: z.string(),
        message:  z.string().optional(),
    }).optional(),
});

const FrameErrorSchema = z.object({
    code:    z.number(),
    reason:  z.string().optional(),
    message: z.string().optional(),
});

const FrameCancelSchema = z.object({
    cancel: z.literal(true),
});

// Non-terminal signals the iframe posts as it works. These are advisory only:
// they tell us the form is doing something (arm/refresh the stall watchdog) or
// that it has returned to an idle, user-interactive state (disarm the watchdog).
const PROCESSING_EVENT_IDS = new Set(['iframe_submitted', 'payment_processing', 'datadome_blocked']);
const IDLE_EVENT_IDS = new Set(['iframe_validationerror']);

const FrameEventSchema = z.object({
    event_id: z.string(),
}).passthrough();

// The iframe posts { "3dsInitiated": true } when a 3DS challenge begins. This is
// a long, user-interactive flow, so we treat it as idle and stop watching for a
// stall.
const Frame3dsInitiatedSchema = z.object({
    '3dsInitiated': z.literal(true),
}).passthrough();

const tryParseJson = (value: string): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
};

interface IPaymentFrameMessageSuccess {
    type: 'success';
    token: string;
    cardInfo: IPaymentCardInfo;
}

interface IPaymentFrameMessageCancelled {
    type: 'cancel';
}

interface IPaymentFrameMessageFailure {
    type: 'error';
    message: string;
}

interface IPaymentFrameMessageUnknown {
    type: 'unknown';
}

interface IPaymentFrameMessageProcessing {
    type: 'processing';
}

interface IPaymentFrameMessageIdle {
    type: 'idle';
}

type PaymentFrameMessage =
    IPaymentFrameMessageSuccess
    | IPaymentFrameMessageCancelled
    | IPaymentFrameMessageFailure
    | IPaymentFrameMessageProcessing
    | IPaymentFrameMessageIdle
    | IPaymentFrameMessageUnknown;

const parseFrameErrorString = (data: string): PaymentFrameMessage => {
    const frameErrorParseResult = FrameErrorSchema.safeParse(tryParseJson(data));
    if (frameErrorParseResult.success) {
        const frameError = frameErrorParseResult.data;
        return {
            type: 'error',
            message: frameError.message ?? frameError.reason ?? 'Payment error'
        };
    }

    return {
        type: 'error',
        message: data
    }
}

const isFrameUserCancellationMessage = (data: unknown) => {
    return FrameCancelSchema.safeParse(data).success;
}

const tryParseFrameCompletionMessage = (data: unknown): PaymentFrameMessage | undefined => {
    const frameMessageParseResult = FrameCompletionMessageSchema.safeParse(data);
    if (!frameMessageParseResult.success) {
        return undefined;
    }

    const decision = frameMessageParseResult.data.gatewayResponseData?.decision;
    if (decision && decision !== 'ACCEPT') {
        const reason = frameMessageParseResult.data.gatewayResponseData?.message ?? decision;
        return {
            type: 'error',
            message: `Payment declined: ${reason}`,
        };
    }

    const token = frameMessageParseResult.data.token ?? frameMessageParseResult.data.transactionReferenceData?.token;
    if (token) {
        return {
            type: 'success',
            cardInfo: {
                accountNumberMasked: frameMessageParseResult.data.cardInfo?.accountNumberMasked ?? '',
                cardIssuer:          frameMessageParseResult.data.cardInfo?.cardIssuer ?? '',
                expirationYearMonth: frameMessageParseResult.data.cardInfo?.expirationYearMonth ?? '',
                cardHolderName:      frameMessageParseResult.data.cardInfo?.cardholderName ?? '',
                postalCode:          frameMessageParseResult.data.cardInfo?.postalCode ?? '',
            },
            token,
        };
    }
}

const tryParseFrameLifecycleMessage = (data: unknown): PaymentFrameMessage | undefined => {
    const threeDsResult = Frame3dsInitiatedSchema.safeParse(data);
    if (threeDsResult.success) {
        return { type: 'idle' };
    }

    const eventResult = FrameEventSchema.safeParse(data);
    if (!eventResult.success) {
        return undefined;
    }

    const eventId = eventResult.data.event_id;
    if (PROCESSING_EVENT_IDS.has(eventId)) {
        return { type: 'processing' };
    }

    if (IDLE_EVENT_IDS.has(eventId)) {
        return { type: 'idle' };
    }

    return undefined;
};

export const parseFrameMessage = (data: unknown): PaymentFrameMessage => {
    if (!data) {
        // Falsy values are benign, non-terminal iframe signals: null (AJAX 200 with
        // no token, form re-enabled for retry) and "" (duplicate submit after
        // success). Treat them as idle so the stall watchdog disarms.
        return { type: 'idle' };
    }

    if (typeof data === 'string') {
        return parseFrameErrorString(data);
    }

    if (isFrameUserCancellationMessage(data)) {
        return { type: 'cancel' };
    }

    const lifecycleMessage = tryParseFrameLifecycleMessage(data);
    if (lifecycleMessage) {
        return lifecycleMessage;
    }

    return tryParseFrameCompletionMessage(data) ?? { type: 'unknown' };
}
