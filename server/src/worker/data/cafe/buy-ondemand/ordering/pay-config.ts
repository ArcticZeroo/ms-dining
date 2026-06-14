import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { IPayConfig, ORDER_TIMEZONE } from '../../../../models/ordering.js';

/**
 * Build a pay config from known constants and ordering context data,
 * avoiding the POST /sites/{contextId}/{displayProfileId} call.
 *
 * Constants are sourced from observed HAR responses across multiple cafes.
 * Dynamic values (terminalId, employeeId, etc.) come from the ordering
 * context which is already populated at this point.
 */
export const buildPayConfig = (orderingContext: IOrderingContext): IPayConfig => ({
    pay:                 { clientId: orderingContext.payClientId },
    displayOptions:      {
        'timezone':                       ORDER_TIMEZONE,
        'currency/currencyCode':          'USD',
        'currency/currencySymbol':        '$',
        'currency/currencyDecimalDigits': '2',
        'currency/currencyCultureName':   'en-US',
        'useIgOrderApi':                  'true',
        'useIgPosApi':                    'false',
        'voidReasonId':                   '11',
        'onDemandTerminalId':             orderingContext.onDemandTerminalId,
        'onDemandEmployeeId':             orderingContext.onDemandEmployeeId,
        'profit-center-id':               orderingContext.profitCenterId,
        'check-type':                     orderingContext.checkTypeId ?? '1',
        'isSmsEnabled':                   'true',
        'isMobileNumberRequired':         'true',
        'isProfileValid':                 'true',
        'name-capture/isOptional':        'false',
        'name-capture/lastInitialOnly':   'true',
    },
    pickUpConfig:        {
        featureEnabled: true,
        kitchenText:    'PICK-UP',
        buttonText:     'PICK-UP',
    },
    emailReceipt:        {
        featureEnabled:          true,
        overrideFromStoreConfig: false,
    },
    checkTypeId:         orderingContext.checkTypeId ?? '1',
    taxBreakupEnabled:   false,
    hideVATInReceipts:   false,
    hideAllPrices:       false,
    hideZeroPrice:       false,
    specialInstructions: {
        headerText:                    'Special instructions',
        characterLimit:                250,
        featureEnabled:                true,
        instructionText:               'Any allergies or requests?',
        additionalSpecialInstructions: [
            {
                characterLimit:  250,
                instructionText: 'Any allergies or requests?',
                kitchenText:     '',
            }
        ],
    },
});