export interface IBuyOnDemandWaitTimeSection {
    minutes: number
}

export interface IBuyOnDemandWaitTimeResponse {
    minTime: IBuyOnDemandWaitTimeSection,
    maxTime: IBuyOnDemandWaitTimeSection
}

export interface IRequestCartItem {
    allowPriceOverride: true,
    amount: string,
    cartItemId: string,
    conceptId: string,
    conceptName: string,
    contextId: string,
    defaultPriceLevelId: string,
    holdAndFire: false,
    id: string,
    menuId: string,
    menuPriceLevelId: string,
    modifierTotal: 0,
    quantity: number,
    options: []
}

export interface IAddToOrderResponse {
    orderDetails: {
        orderId: string,
        orderNumber: string,
        taxExcludedTotalAmount: {
            amount: string
        },
        taxTotalAmount: {
            amount: string
        },
        totalDueAmount: {
            amount: string
        },
    },
}

export interface IRetrieveCardProcessorTokenResponse {
    token: string
}

export interface ICardProcessorPaymentResponse {
    token?: string;
    transactionReferenceData?: {
        token: string;
    }
}

// Unclear which bits (if any) can be removed in the request.
// Will need to do some testing to figure out what is required.
// We have most of this info, more research required?
export interface ICloseOrderRequest {
    contextId: string,
    tenantId: string,
    profitCenterId: string,
    // Guessing that order can be only the id?
    order: {
        orderId: string,
        version: 1,
        tenantId: string,
        contextId: string,
        // ISO string
        created: string,
        // ISO string
        lastUpdated: string,
        orderState: 'OPEN',
        orderNumber: string,
        currencyUnit: 'USD',
        lineItems: [
            {
                // buy-ondemand id
                itemId: string,
                // buy-ondemand itemId
                igItemId: string,
                itemType: 'ITEM',
                // not sure where this is from
                'lineItemId': 'dde089a7-a405-4222-b29e-cdfb3eabfdc4',
                'soldByWeight': false,
                'lineItemState': 'NORMAL',
                'quantity': 1,
                'ancestorQuantityMultipliers': [],
                'totalQuantity': 1,
                'price': {
                    'currencyUnit': 'USD',
                    // e.g. "6.99"
                    'amount': string
                },
                'properties': {
                    // special instructions! leave empty if none?
                    'splInstruction': string,
                    'orderSourceSystem': 'onDemand',
                    'mealPeriodId': '2',
                    'priceLevelId': string,
                    // no kp text here? weird.
                    'displayText': 'Meatball Grinder',
                    'menuId': string,
                    // e.g. "6.99"
                    'amount': string,
                    'conceptId': string,
                    'conceptName': string,
                    'tagNames': '[]',
                    'tagIds': '[]',
                    'count': '1',
                    'quantity': '1',
                    // item id-epoch time
                    'cartGuid': string,
                    // item id-epoch time
                    'uniqueId': string,
                    'holdForItems': 'false',
                    // Both available in get-items
                    // "productClassId": "81",
                    // "revenueCategoryId": "12"
                },
                'lineItemInstructions': [
                    {
                        'label': '',
                        'text': string
                    }
                ] | []
            }
        ],
        properties: {
            orderNumberSequenceLength: '4',
            profitCenterId: string,
            displayProfileId: string,
            // terminal id
            orderNumberNameSpace: string,
            closeScheduleExpression: '0 0 23 * * *',
            openTerminalId: string,
            priceLevelId: string,
            employeeId: string,
            // 2 = lunch
            mealPeriodId: '2',
            closedTerminalId: string,
            orderSourceSystem: 'onDemand',
            openScheduleExpression: '0 0 0 * * *',
            useIgOrderApi: 'true'
        }
    },
    'displayProfileId': string,
    'mobileNumberCountryCode': '1',
    'conceptId': string,
    'mealPeriodId': '2',
    // context id
    'siteId': string,
    // displayProfileId
    'profileId': string,
    'scheduledDay': 0,
    'shouldRefundOnFailure': false,
    'notifyGuestOnFailure': false,
    'useIgPosApi': false,
    'storePriceLevel': string,
    'profitCenterName': string,
    // MSFT alias
    'firstName': string,
    'lastName': '',
    'tokenizedData': {
        'paymentDetails': {
            // e.g. "0.71"
            taxAmount: string,
            // order id
            invoiceId: string,
            // ISO string
            billDate: string,
            // ISO string
            userCurrentDate: string,
            currencyUnit: 'USD',
            // $`Order {orderId}`
            description: string,
            // e.g. "7.70"
            transactionAmount: string,
            // e.g. 7.7
            multiPaymentAmount: number,
            isWindCave: false,
            isCyberSource: false,
            isCyberSourceWallets: false,
            language: 'en',
            // XSS token
            apiToken: string,
            // tenant id
            'payTenantId': string,
            // "123456xxxxxx1234"
            accountNumberMasked: string,
            // e.g. "visa". not sure what to pass for other card types
            cardIssuer: string,
            // year + month without a space, e.g. 202301
            'expirationYearMonth': string,
            'cardHolderName': string,
            'postalCode': string
        },
        saveCardFlag: false,
        // Token returned by the card processor site
        token: string
    },
    orderVersion: 1,
    terminalId: string,
    processPaymentAsExternalPayment: false,
    // e.g. "7.70"
    authorizedAmount: string,
    receiptInfo: {
        orderData: {
            orderId: string,
            version: 1,
            tenantId: string,
            contextId: string,
            // ISO string
            created: string,
            // ISO string
            lastUpdated: string,
            orderState: 'OPEN',
            // order ID string
            orderNumber: string,
            currencyUnit: 'USD',
            'lineItems': [
                {
                    // buy-ondemand id
                    'itemId': string,
                    // buy-ondemand itemId
                    'igItemId': string,
                    'itemType': 'ITEM',
                    'lineItemId': 'dde089a7-a405-4222-b29e-cdfb3eabfdc4',
                    'soldByWeight': false,
                    'lineItemState': 'NORMAL',
                    'quantity': 1,
                    'totalQuantity': 1,
                    'price': {
                        'currencyUnit': 'USD',
                        // e.g. "6.99"
                        'amount': string
                    },
                    'properties': {
                        'splInstruction': string,
                        'orderSourceSystem': 'onDemand',
                        'mealPeriodId': '2',
                        'priceLevelId': string,
                        'displayText': string,
                        'menuId': string,
                        // e.g. "6.99"
                        'amount': string,
                        'conceptId': string,
                        'count': '1',
                        'quantity': '1',
                        // "calories": "950",
                        // item id-epoch time
                        'cartGuid': string,
                        // item id-epoch time
                        'uniqueId': string,
                        'holdForItems': 'false',
                        // "productClassId": "81",
                        // "revenueCategoryId": "12"
                    },
                    'lineItemInstructions': [
                        {
                            'label': '',
                            'text': string
                        }
                    ] | []
                }
            ],
            'properties': {
                'orderNumberSequenceLength': '4',
                'profitCenterId': string,
                'displayProfileId': string,
                // terminal id
                'orderNumberNameSpace': string,
                'closeScheduleExpression': '0 0 23 * * *',
                'openTerminalId': string,
                'priceLevelId': string,
                'employeeId': string,
                'mealPeriodId': '2',
                'closedTerminalId': string,
                'orderSourceSystem': 'onDemand',
                'openScheduleExpression': '0 0 0 * * *',
                'useIgOrderApi': 'true'
            },
            'internalProperties': {},
            'configuredBuyFeatures': []
        },
        'showConceptNameInEmailReceipt': false,
        'showConceptNameInTextReceipt': false,
        'showConceptNameInPrintReceipt': false,
        'items': [
            {
                'id': '653ff13d0b49d13808845215',
                'contextId': string,
                'tenantId': string,
                // "itemId": "1111014",
                // "name": "GRNDR-REV-Meatball Grinder",
                'isDeleted': false,
                'isActive': false,
                // from get-items
                // "revenueCategoryId": "12",
                // "productClassId": "81",
                'kpText': string,
                'kitchenDisplayText': string,
                'receiptText': string,
                'price': {
                    'currencyUnit': 'USD',
                    // e.g. "6.99"
                    'amount': string
                },
                'defaultPriceLevelId': string,
                'isSoldByWeight': false,
                'tareWeight': 0,
                'isDiscountable': false,
                'allowPriceOverride': true,
                'isTaxIncluded': false,
                'itemType': 'ITEM',
                'displayText': string,
                'isAvailableToGuests': true,
                'isPreselectedToGuests': false,
                'tagNames': [],
                'tagIds': [],
                'substituteItemId': '',
                'isSubstituteItem': false,
                'properties': {
                    'cartGuid': string,
                    'scannedItem': false,
                    'priceLevelId': string
                },
                'amount': '6.99',
                'menuPriceLevelId': string,
                'menuId': '16650',
                'menuPriceLevelApplied': false,
                'options': [],
                'attributes': [],
                'conceptId': '10927',
                'isItemCustomizationEnabled': false,
                'holdAndFire': false,
                'count': 1,
                'quantity': 1,
                'lineItemInstructions': [
                    {
                        'label': '',
                        'text': 'N/A'
                    }
                ],
                'conceptName': 'Parlor',
                'modifierTotal': 0,
                'mealPeriodId': null,
                // The real buy-ondemand site takes the item id, and adds the added-to-cart time to it.
                // e.g. $`{itemId}-${Date.now()}`
                'uniqueId': string,
                'cartItemId': '24f8ba07-b865-424f-8acd-8e879200b7ae',
                'lineItemId': 'dde089a7-a405-4222-b29e-cdfb3eabfdc4'
            }
        ],
        // ISO string
        'orderPlacedTime': string,
        // e.g. "Dec 13, 2023"
        'receiptDate': string,
        // e.g. "12:47 PM"
        'receiptTime': string,
        'timeZone': 'PST8PDT',
        terminalId: string,
        // order number string
        checkNumber: string,
        'scheduledDay': 0,
        'birConfig': {
            'displayText': 'OR#',
            'acknowledgementReceiptDisplayText': 'AR#',
            'acknowledgementReceiptIndicator': 'Acknowledgement Receipt#',
            'officialReceiptIndicator': 'Official Receipt#'
        },
        multiPassEnabled: false,
        // Intentional typo
        receipientName: string,
        // ISO string
        dateTimeInReceipt: string,
        timezoneOffsetMinutes: number,
        // "Dec 13, 2023 12:47 PM "
        printDateTime: string,
        // ISO string
        closedTime: string,
        displayProfileId: string
    }
}