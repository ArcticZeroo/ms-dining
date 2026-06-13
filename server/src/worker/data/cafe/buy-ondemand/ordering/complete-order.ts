import { BuyOnDemandClient, JSON_HEADERS } from '../../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { MEAL_PERIOD } from '../../../../../shared/constants/enum.js';
import { fixed } from '../../../../../shared/util/math.js';
import { buildStoreInfo, formatReceiptDateTime, toLocalIsoOffset } from '../../../util/order.js';
import { asRecord } from '../../../../../shared/util/typeguard.js';
import { IBuyOnDemandOrderDetails, IBuyOnDemandReceiptItem } from '../../../../models/buy-ondemand.js';
import { IWaitTimeResponse } from '@msdining/common/models/http';
import {
    IOrderTotalPrice,
    IPayConfig,
    IPickupConfig,
    ISiteStoreInfo,
    ORDER_TIMEZONE
} from '../../../../models/ordering.js';
import { PhoneValidResult } from 'phone';
import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { IPaymentCardInfo } from '@msdining/common/models/cart';

interface ICompleteOrderAfterIFramePaymentParams {
    client: BuyOnDemandClient;
    alias: string;
    readyTime: IWaitTimeResponse;
    payConfig: IPayConfig;
    orderId: string;
    orderNumber: string;
    phoneData: PhoneValidResult;
    orderingContext: IOrderingContext;
    cardInfo: IPaymentCardInfo;
    pickupConfig: IPickupConfig;
    siteStoreInfo: ISiteStoreInfo;
    price: IOrderTotalPrice;
    receiptItems: Array<IBuyOnDemandReceiptItem>;
    firstStationId: string;
    lastOrderDetails: IBuyOnDemandOrderDetails;
    cardProcessorToken: string;
    paymentToken: string;
}

export const completeOrderAfterIframePaymentAsync = async ({
    client,
    alias,
    readyTime,
    payConfig,
    orderId,
    orderNumber,
    phoneData,
    orderingContext,
    pickupConfig,
    cardInfo,
    siteStoreInfo,
    price,
    receiptItems,
    firstStationId,
    lastOrderDetails,
    cardProcessorToken,
    paymentToken
}: ICompleteOrderAfterIFramePaymentParams) => {
    const now = new Date();
    const nowString = toLocalIsoOffset(now);
    const closedTime = now.toISOString();
    const receiptDateTime = formatReceiptDateTime(now);

    const additionalSpecialInstructions = payConfig.specialInstructions?.additionalSpecialInstructions || [];
    const currencyDetails = {
        currencyDecimalDigits: '2',
        currencyCultureName:   'en-US',
        currencyCode:          'USD',
        currencySymbol:        '$'
    };
    const deliveryProperties = {
        deliveryOption:     {
            id:                      'pickup',
            kitchenText:             pickupConfig?.kitchenText ?? 'PICKUP',
            displayText:             pickupConfig?.buttonText ?? 'PICKUP',
            defaultConfirmationText: pickupConfig?.defaultConfirmationText ?? 'Thank you!',
            conceptEntries:          {},
            isEnabled:               true,
            orderSequence:           1,
        },
        fulfillmentDetails: {
            fulfillmentType: 'pickupFormFields',
        },
        isCutleryEnabled:   false,
        nameCapture:        {
            firstName:   alias,
            lastInitial: ''
        },
        nameString:         `${alias} `
    };
    const readyTimeDetails = {
        minTime: {
            minutes:    readyTime.minTime,
            fieldType:  { name: 'minutes' },
            periodType: { name: 'Minutes' }
        },
        maxTime: {
            minutes:    readyTime.maxTime,
            fieldType:  { name: 'minutes' },
            periodType: { name: 'Minutes' }
        }
    };
    const browserStoreInfo = buildStoreInfo({
        ...siteStoreInfo,
        businessContextId: client.config.contextId,
        tenantId:          client.config.tenantId,
        storeInfoId:       client.config.storeId,
        storeName:         client.config.externalName,
    });
    const browserStoreInfoOptions = asRecord(browserStoreInfo.storeInfoOptions) ?? {};

    const taxClassList: Array<{ amount: string, amountValue: string }> = [];
    if (price.tax > 0) {
        const taxAmountValue = price.tax.toFixed(2);
        taxClassList.push({ amount: `${taxAmountValue}`, amountValue: taxAmountValue });
    }

    const selectedSMSCountry = phoneData.countryCode === '+1'
        ? { value: 'US', label: 'United States', phoneCode: '1' }
        : undefined;
    const closeOrderDetails = {
        ...lastOrderDetails,
        properties: {
            ...lastOrderDetails.properties,
            orderNumberSequenceLength: '4',
            profitCenterId:            orderingContext.profitCenterId,
            displayProfileId:          client.config.displayProfileId,
            orderNumberNameSpace:      orderingContext.onDemandTerminalId,
            openTerminalId:            orderingContext.onDemandTerminalId,
            priceLevelId:              orderingContext.storePriceLevel,
            employeeId:                orderingContext.onDemandEmployeeId,
            mealPeriodId:              String(MEAL_PERIOD.lunch),
            closedTerminalId:          orderingContext.onDemandTerminalId,
            voidReasonId:              '11',
            orderSourceSystem:         'onDemand',
            additionalGuestData:       '{}',
            useIgOrderApi:             'true',
        },
        ...(additionalSpecialInstructions.length > 0 ? { additionalSpecialInstructions } : {}),
    };

    await client.requestAsync(
        `/order/${client.config.tenantId}/${client.config.contextId}/orderId/${orderId}/processPaymentAndClosedOrder`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                amHereConfig:                     {
                    isCurbsidePickup: false,
                    lateTolerance:    5,
                    origin:           `https://${client.cafe.id}.buy-ondemand.com`
                },
                authorizedAmount:                 price.total.toString(),
                calorieTotal:                     {
                    baseCalorie: 0,
                    maxCalorie:  0
                },
                capacitySuggestionPerformed:      false,
                conceptId:                        firstStationId,
                contextId:                        client.config.contextId,
                currencyDetails,
                currencyUnit:                     'USD',
                customCardCodeMapping:            false,
                customerAddress:                  [],
                cyberSourcePaymentData:           null,
                cyberSourceTransactionData:       null,
                deliveryProperties,
                discountInfo:                     [],
                displayProfileId:                 client.config.displayProfileId,
                emailInfo:                        {
                    ...(payConfig.emailReceipt || {}),
                    customerAddress: [],
                },
                engageAccrualEnabled:             false,
                engagePromotionAppliedPromotions: [],
                engagePromotionCardNumber:        null,
                engagePromotionLastName:          '',
                firstName:                        alias,
                giftCardSaleDataMap:              {},
                graceCompletionTime:              false,
                gratuityBreakupConfigEnabled:     false,
                igOrderStatusConfig:              {},
                igSettings:                       payConfig.displayOptions || {},
                isGaPaymentAvailable:             false,
                itemCountdown:                    {},
                kitchenContextId:                 null,
                lastName:                         '',
                locizeConfig:                     {
                    currentLanguage:     'en',
                    shouldUseLocizeText: false,
                    domain:              `${client.cafe.id}.buy-ondemand.com`,
                    storeInfo:           browserStoreInfo,
                    scheduledDay:        0,
                    dateTime:            'en',
                    readyTime:           readyTimeDetails,
                    deliveryProperties,
                    multiLanguageConfig: {},
                    locizeVersion:       'production',
                },
                loyaltyGuestInfo:                 {},
                loyaltyPayment:                   false,
                mealPeriodId:                     String(MEAL_PERIOD.lunch),
                mobileNumber:                     phoneData.phoneNumber,
                mobileNumberCountryCode:          phoneData.countryCode,
                multiPassEnabled:                 false,
                notifyGuestOnFailure:             false,
                order:                            closeOrderDetails,
                orderGuid:                        null,
                orderVersion:                     1,
                paymentType:                      null,
                processPaymentAsExternalPayment:  false,
                profileId:                        client.config.displayProfileId,
                profitCenterId:                   orderingContext.profitCenterId,
                profitCenterName:                 orderingContext.profitCenterName,
                recallCheck:                      false,
                receiptInfo:                      {
                    orderData:                           closeOrderDetails,
                    showConceptNameInEmailReceipt:       false,
                    showConceptNameInTextReceipt:        false,
                    showConceptNameInPrintReceipt:       false,
                    taxBreakupEnabled:                   payConfig.taxBreakupEnabled,
                    taxClassList,
                    hideVATInReceipts:                   payConfig.hideVATInReceipts,
                    items:                               receiptItems,
                    tip:                                 0,
                    tipAmount:                           0,
                    etfEnabled:                          true,
                    dateTime:                            'en',
                    storePriceLevel:                     orderingContext.storePriceLevel,
                    currencyDetails,
                    deliveryEnabled:                     false,
                    readyTime:                           readyTimeDetails,
                    deliveryProperties,
                    vatEntries:                          [],
                    taxIdentificationNumber:             '',
                    accountNumberLabelText:              'GA account number',
                    engageLoyaltyAccountNumberLabelText: 'Account number',
                    engageMemberAccountNumberLabelText:  'Account number',
                    gaAccountInfoList:                   [],
                    deliveryConfirmationText:            pickupConfig?.defaultConfirmationText ?? 'Thank you!',
                    orderPlacedTime:                     closedTime,
                    receiptDate:                         receiptDateTime.receiptDate,
                    receiptTime:                         receiptDateTime.receiptTime,
                    timeZone:                            ORDER_TIMEZONE,
                    terminalId:                          orderingContext.onDemandTerminalId,
                    checkNumber:                         orderNumber,
                    selectedSMSCountry,
                    mobileNumber:                        phoneData.phoneNumber,
                    scheduledDay:                        0,
                    hideAllPrices:                       payConfig.hideAllPrices,
                    hideZeroPrice:                       payConfig.hideZeroPrice,
                    complimentaryPayment:                false,
                    isPayLater:                          false,
                    payLaterConfig:                      {},
                    discountValues:                      [],
                    franceFiscalConfig:                  { isEnabled: false },
                    birConfig:                           browserStoreInfoOptions.birConfig,
                    multiPassEnabled:                    false,
                    // Intentional typo.
                    receipientName:              `${alias} `,
                    orderMessage: `Your order will be ready for pickup at ${client.config.externalName} in about ${readyTime.minTime} to ${readyTime.maxTime} minutes\n\n`,
                    dateTimeInReceipt:           receiptDateTime.dateTimeInReceipt,
                    timezoneOffsetMinutes:       receiptDateTime.timezoneOffsetMinutes,
                    printDateTime:               receiptDateTime.printDateTime,
                    closedTime,
                    gratuityWithLabelArray:      false,
                    serviceAmountWithLabelArray: false,
                    displayProfileId:            client.config.displayProfileId,
                    engagePayment:               { engageAccountInfoList: [] },
                    engageLoyaltyPayment:        { engageLoyaltyAccountInfoList: [] },
                },
                saleTransactionData:              null,
                scannedItemOrder:                 false,
                scheduledDay:                     0,
                shouldRefundOnFailure:            false,
                siteId:                           client.config.contextId,
                storePriceLevel:                  orderingContext.storePriceLevel,
                stripeTransactionData:            null,
                subtotal:                         price.subtotal.toFixed(2),
                tenantId:                         client.config.tenantId,
                terminalId:                       orderingContext.onDemandTerminalId,
                textReceiptConfig:                {
                    textMessageWithReceiptLink: false
                },
                tipAmount:                        0,
                tipPercent:                       0,
                tokenizedData:                    {
                    paymentDetails: {
                        taxAmount:             price.tax.toFixed(2),
                        invoiceId:             orderNumber,
                        billDate:              lastOrderDetails.created ?? nowString,
                        userCurrentDate:       nowString,
                        currencyUnit:          'USD',
                        description:           `Order ${orderNumber}`,
                        transactionAmount:     price.total.toFixed(2),
                        remainingTipAmount:    '0.00',
                        tipAmount:             '0.00',
                        style:                 `https://${client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${client.cafe.id}.buy-ondemand.com/false/false/false`,
                        multiPaymentAmount:    fixed(price.total, 2),
                        isWindCave:            false,
                        isCyberSource:         false,
                        isCyberSourceWallets:  false,
                        language:              'en',
                        apiToken:              cardProcessorToken,
                        payTenantId:           client.config.tenantId,
                        previousTransactionId: null,
                        accountNumberMasked:   cardInfo.accountNumberMasked,
                        cardIssuer:            cardInfo.cardIssuer,
                        expirationYearMonth:   cardInfo.expirationYearMonth,
                        cardHolderName:        cardInfo.cardHolderName,
                        postalCode:            cardInfo.postalCode,
                    },
                    saveCardFlag:   false,
                    token:          paymentToken
                },
                previousTransactionId:            null,
                previousTransactionTokenInfo:     null,
                use24HrTimeFormat:                false,
                useIgPosApi:                      false,
                walletPaymentData:                null,
                walletSaleTransactionData:        null
            })
        },
    );
}