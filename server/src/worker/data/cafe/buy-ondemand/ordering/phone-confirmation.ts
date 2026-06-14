import { BuyOnDemandClient, JSON_HEADERS } from '../../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { PhoneValidResult } from 'phone';

interface ISendPhoneConfirmationParams {
    client: BuyOnDemandClient;
    orderId: string;
    phoneData: PhoneValidResult;
}

export const sendPhoneConfirmationAfterOrderCompletion = async ({ client, orderId, phoneData }: ISendPhoneConfirmationParams) => {
    return client.requestAsync(`/communication/sendSMSReceipt`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                contextId:         client.config.contextId,
                orderId:           orderId,
                sendOrderTo:       phoneData.phoneNumber,
                smsConfig:         {
                    overrideFromStoreConfig: true,
                    introText:               '🐧 Thank you for placing your order with {{N}}',
                    isItemizedListEnabled:   true,
                    isTotalsEnabled:         true,
                    isIntroEnabled:          true,
                    showCompleteCheckNumber: true,
                    appReceipt:              {
                        introText:      '🐧 Thank you for placing your order with {{N}}. Your order number is {{O}}',
                        enableFallback: false,
                    },
                    linkIntroText:           '🐧 Thank you for placing your order with {{N}}. Please find your receipt here {{L}}'
                },
                isCateringEnabled: false,
                textReceiptConfig: {
                    featureEnabled:  true,
                    headerText:      'Text receipt',
                    instructionText: 'Enter your phone number. Message & data rates may apply.',
                    autoSendEnabled: true
                },
                displayProfileId:  client.config.displayProfileId,
            })
        });
}