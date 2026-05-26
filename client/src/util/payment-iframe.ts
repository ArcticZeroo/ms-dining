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

type PaymentFrameMessage =
    IPaymentFrameMessageSuccess
    | IPaymentFrameMessageCancelled
    | IPaymentFrameMessageFailure
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

export const parseFrameMessage = (data: unknown): PaymentFrameMessage => {
    if (!data) {
        return { type: 'unknown' };
    }

    if (typeof data === 'string') {
        return parseFrameErrorString(data);
    }

    if (isFrameUserCancellationMessage(data)) {
        return { type: 'cancel' };
    }

    return tryParseFrameCompletionMessage(data) ?? { type: 'unknown' };
}
