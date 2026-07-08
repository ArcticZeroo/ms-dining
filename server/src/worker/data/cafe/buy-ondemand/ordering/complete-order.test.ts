/**
 * Unit tests for resolveDeliveryOption — the pure mapping from fulfillment type +
 * label configs to the BoD delivery-option block, form-fields type, and confirmation
 * text used in the close-order payload. Proves pickup stays byte-identical to the
 * legacy hard-coded values and dine-in flips id/labels/form-fields (no table number).
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveDeliveryOption } from './complete-order.js';

const CONFIGS = {
    pickupConfig: { kitchenText: 'PICK-UP', buttonText: 'PICKUP', defaultConfirmationText: 'Pickup thanks!' },
    dineInConfig: { kitchenText: 'DINE IN', buttonText: 'DINE IN', defaultConfirmationText: 'Dine-in thanks!' },
};

test('pickup uses pickup id/labels/form-fields from pickupConfig', () => {
    const { deliveryOption, formFieldsType, confirmationText } = resolveDeliveryOption('pickup', CONFIGS);

    assert.equal(deliveryOption.id, 'pickup');
    assert.equal(deliveryOption.kitchenText, 'PICK-UP');
    assert.equal(deliveryOption.displayText, 'PICKUP');
    assert.equal(deliveryOption.defaultConfirmationText, 'Pickup thanks!');
    assert.equal(formFieldsType, 'pickupFormFields');
    assert.equal(confirmationText, 'Pickup thanks!');
});

test('dineIn uses dineIn id/labels/form-fields from dineInConfig', () => {
    const { deliveryOption, formFieldsType, confirmationText } = resolveDeliveryOption('dineIn', CONFIGS);

    assert.equal(deliveryOption.id, 'dineIn');
    assert.equal(deliveryOption.kitchenText, 'DINE IN');
    assert.equal(deliveryOption.displayText, 'DINE IN');
    assert.equal(deliveryOption.defaultConfirmationText, 'Dine-in thanks!');
    assert.equal(formFieldsType, 'dineInFormFields');
    assert.equal(confirmationText, 'Dine-in thanks!');
});

test('the constant deliveryOption fields are preserved for both types', () => {
    for (const fulfillmentType of ['pickup', 'dineIn'] as const) {
        const { deliveryOption } = resolveDeliveryOption(fulfillmentType, CONFIGS);
        assert.deepEqual(deliveryOption.conceptEntries, {});
        assert.equal(deliveryOption.isEnabled, true);
        assert.equal(deliveryOption.orderSequence, 1);
    }
});

test('falls back to default labels/confirmation when config is empty', () => {
    const empty = { pickupConfig: {}, dineInConfig: {} };

    const pickup = resolveDeliveryOption('pickup', empty);
    assert.equal(pickup.deliveryOption.kitchenText, 'PICKUP');
    assert.equal(pickup.deliveryOption.displayText, 'PICKUP');
    assert.equal(pickup.confirmationText, 'Thank you!');

    const dineIn = resolveDeliveryOption('dineIn', empty);
    assert.equal(dineIn.deliveryOption.kitchenText, 'DINE IN');
    assert.equal(dineIn.deliveryOption.displayText, 'DINE IN');
    assert.equal(dineIn.confirmationText, 'Thank you!');
});
