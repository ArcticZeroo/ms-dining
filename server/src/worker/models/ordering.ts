import z from 'zod';
import type { IOrderItem } from '@msdining/common/models/order';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { IStationRecord } from '../../shared/services/station.js';

const PickUpConfigSchema = z.object({
    kitchenText:             z.string().optional(),
    buttonText:              z.string().optional(),
    defaultConfirmationText: z.string().optional(),
}).passthrough();

export type IPickupConfig = z.infer<typeof PickUpConfigSchema>;

export const PayConfigSchema = z.object({
    pay:                 z.object({ clientId: z.string() }),
    displayOptions:      z.record(z.unknown()),
    pickUpConfig:        PickUpConfigSchema.optional(),
    emailReceipt:        z.record(z.unknown()).optional(),
    checkTypeId:         z.string().optional(),
    taxBreakupEnabled:   z.boolean().optional(),
    hideVATInReceipts:   z.boolean().optional(),
    hideAllPrices:       z.boolean().optional(),
    hideZeroPrice:       z.boolean().optional(),
    specialInstructions: z.object({
        additionalSpecialInstructions: z.array(z.object({
            characterLimit: z.number(),
            instructionText: z.string(),
            kitchenText: z.string(),
        })).optional(),
    }).passthrough().optional(),
}).passthrough();

export type IPayConfig = z.infer<typeof PayConfigSchema>;

const SiteStoreInfoSchema = z.record(z.unknown());

export type ISiteStoreInfo = z.infer<typeof SiteStoreInfoSchema>;

export const SiteDataItemSchema = z.object({
    storePriceLevel: z.string(),
    displayOptions:  z.object({
        onDemandTerminalId: z.string(),
        onDemandEmployeeId: z.string(),
        'profit-center-id': z.string(),
        'check-type':       z.string().optional(),
    }).passthrough(),
    siteStoreInfo:   SiteStoreInfoSchema.optional(),
    pickUpConfig:    PickUpConfigSchema.optional(),
}).passthrough();

export type ISiteData = z.infer<typeof SiteDataItemSchema>;

export interface IOrderTotalPrice {
    subtotal: number;
    tax: number;
    total: number;
}

export const ORDER_TIMEZONE = 'PST8PDT';

export interface IEnhancedOrderItem extends IOrderItem {
    menuItem: IMenuItemBase;
    station: IStationRecord;
    // BoD wire identifiers, derived once when the (immutable) cart is enhanced so
    // every rebuild — add, wait-time, receipt — reuses the same values.
    // cartGuid is shared across the cart; uniqueId is distinct per line.
    cartGuid: string;
    uniqueId: string;
}