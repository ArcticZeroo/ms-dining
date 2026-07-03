import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { parseFrameMessage } from '../../src/util/payment-iframe.ts';

describe('parseFrameMessage', () => {
    // ─── Idle / falsy inputs ─────────────────────────────────────────
    // Falsy values are benign, non-terminal iframe signals (null = no token,
    // "" = duplicate submit), so they disarm the stall watchdog via 'idle'.

    it('returns idle for null', () => {
        assert.strictEqual(parseFrameMessage(null).type, 'idle');
    });

    it('returns idle for undefined', () => {
        assert.strictEqual(parseFrameMessage(undefined).type, 'idle');
    });

    it('returns idle for empty string', () => {
        assert.strictEqual(parseFrameMessage('').type, 'idle');
    });

    it('returns idle for 0', () => {
        assert.strictEqual(parseFrameMessage(0).type, 'idle');
    });

    // ─── Unknown ─────────────────────────────────────────────────────

    it('returns unknown for unrecognized object', () => {
        assert.strictEqual(parseFrameMessage({ foo: 'bar' }).type, 'unknown');
    });

    // ─── Lifecycle: processing ───────────────────────────────────────

    it('returns processing for iframe_submitted', () => {
        const result = parseFrameMessage({ event_id: 'iframe_submitted', data: '' });
        assert.strictEqual(result.type, 'processing');
        assert.strictEqual((result as { reason: string }).reason, 'submitted');
    });

    it('returns processing for payment_processing', () => {
        const result = parseFrameMessage({ event_id: 'payment_processing', data: '' });
        assert.strictEqual(result.type, 'processing');
        assert.strictEqual((result as { reason: string }).reason, 'processing');
    });

    it('returns processing for datadome_blocked', () => {
        const result = parseFrameMessage({ event_id: 'datadome_blocked', status: 403 });
        assert.strictEqual(result.type, 'processing');
        assert.strictEqual((result as { reason: string }).reason, 'datadome');
    });

    // ─── Lifecycle: idle ─────────────────────────────────────────────

    it('returns idle for iframe_validationerror', () => {
        assert.strictEqual(parseFrameMessage({ event_id: 'iframe_validationerror', data: '' }).type, 'idle');
    });

    it('returns idle for 3dsInitiated', () => {
        assert.strictEqual(parseFrameMessage({ '3dsInitiated': true }).type, 'idle');
    });

    it('returns unknown for an unrecognized event_id', () => {
        assert.strictEqual(parseFrameMessage({ event_id: 'some_future_event' }).type, 'unknown');
    });

    // ─── Cancel ──────────────────────────────────────────────────────

    it('returns cancel for { cancel: true }', () => {
        assert.strictEqual(parseFrameMessage({ cancel: true }).type, 'cancel');
    });

    it('does not treat { cancel: false } as cancel', () => {
        assert.notStrictEqual(parseFrameMessage({ cancel: false }).type, 'cancel');
    });

    // ─── String errors ───────────────────────────────────────────────

    it('returns error with the raw string for a non-JSON string', () => {
        const result = parseFrameMessage('something went wrong');
        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'something went wrong');
    });

    it('parses a JSON error string with message', () => {
        const json = JSON.stringify({ code: 400, message: 'Invalid card number' });
        const result = parseFrameMessage(json);
        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'Invalid card number');
    });

    it('parses a JSON error string with reason when message is absent', () => {
        const json = JSON.stringify({ code: 500, reason: 'Server error' });
        const result = parseFrameMessage(json);
        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'Server error');
    });

    it('falls back to "Payment error" when JSON error has neither message nor reason', () => {
        const json = JSON.stringify({ code: 999 });
        const result = parseFrameMessage(json);
        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'Payment error');
    });

    // ─── Success with top-level token ────────────────────────────────

    it('returns success with top-level token and card info', () => {
        const result = parseFrameMessage({
            token:    'tok_123',
            cardInfo: {
                cardIssuer:          'Visa',
                accountNumberMasked: '****1234',
                expirationYearMonth: '2028-01',
                cardholderName:      'Jane Doe',
                postalCode:          '98101',
            },
        });

        assert.strictEqual(result.type, 'success');
        const success = result as { token: string; cardInfo: Record<string, string> };
        assert.strictEqual(success.token, 'tok_123');
        assert.strictEqual(success.cardInfo.accountNumberMasked, '****1234');
        assert.strictEqual(success.cardInfo.cardIssuer, 'Visa');
        assert.strictEqual(success.cardInfo.expirationYearMonth, '2028-01');
        assert.strictEqual(success.cardInfo.cardHolderName, 'Jane Doe');
        assert.strictEqual(success.cardInfo.postalCode, '98101');
    });

    // ─── Success with transactionReferenceData token ─────────────────

    it('returns success using transactionReferenceData.token when top-level token is absent', () => {
        const result = parseFrameMessage({
            transactionReferenceData: { token: 'ref_456' },
        });

        assert.strictEqual(result.type, 'success');
        assert.strictEqual((result as { token: string }).token, 'ref_456');
    });

    it('prefers top-level token over transactionReferenceData.token', () => {
        const result = parseFrameMessage({
            token:                    'tok_top',
            transactionReferenceData: { token: 'tok_ref' },
        });

        assert.strictEqual(result.type, 'success');
        assert.strictEqual((result as { token: string }).token, 'tok_top');
    });

    // ─── Success with missing card info defaults to empty strings ────

    it('defaults card info fields to empty strings when cardInfo is absent', () => {
        const result = parseFrameMessage({ token: 'tok_no_card' });

        assert.strictEqual(result.type, 'success');
        const success = result as { cardInfo: Record<string, string> };
        assert.strictEqual(success.cardInfo.accountNumberMasked, '');
        assert.strictEqual(success.cardInfo.cardIssuer, '');
        assert.strictEqual(success.cardInfo.expirationYearMonth, '');
        assert.strictEqual(success.cardInfo.cardHolderName, '');
        assert.strictEqual(success.cardInfo.postalCode, '');
    });

    // ─── Gateway declined ────────────────────────────────────────────

    it('returns error when gateway decision is not ACCEPT', () => {
        const result = parseFrameMessage({
            token:               'tok_declined',
            gatewayResponseData: { decision: 'REJECT', message: 'Insufficient funds' },
        });

        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'Payment declined: Insufficient funds');
    });

    it('uses gateway decision as reason when message is absent', () => {
        const result = parseFrameMessage({
            token:               'tok_declined',
            gatewayResponseData: { decision: 'REJECT' },
        });

        assert.strictEqual(result.type, 'error');
        assert.strictEqual((result as { message: string }).message, 'Payment declined: REJECT');
    });

    it('returns success when gateway decision is ACCEPT', () => {
        const result = parseFrameMessage({
            token:               'tok_ok',
            gatewayResponseData: { decision: 'ACCEPT' },
        });

        assert.strictEqual(result.type, 'success');
        assert.strictEqual((result as { token: string }).token, 'tok_ok');
    });

    // ─── No token at all ─────────────────────────────────────────────

    it('returns unknown when object matches schema but has no token anywhere', () => {
        const result = parseFrameMessage({
            gatewayResponseData: { decision: 'ACCEPT' },
        });

        assert.strictEqual(result.type, 'unknown');
    });

    // ─── Extra fields are tolerated (passthrough) ────────────────────

    it('tolerates extra fields on card info via passthrough', () => {
        const result = parseFrameMessage({
            token:    'tok_extra',
            cardInfo: {
                cardIssuer:          'MC',
                accountNumberMasked: '****5678',
                expirationYearMonth: '2030-12',
                cardholderName:      'John',
                postalCode:          '10001',
                extraField:          'should not break',
            },
        });

        assert.strictEqual(result.type, 'success');
        assert.strictEqual((result as { token: string }).token, 'tok_extra');
    });
});
