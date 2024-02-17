import creditCardType from 'credit-card-type';

export const BUY_ONDEMAND_CARD_TYPE = {
    visa:       'visa',
    amex:       'amex',
    mastercard: 'mastercard',
    discover:   'discover',
    unionpay:   'unionpay',
    jcb:        'jcb',
    laser:      'laser',
    dinersclub: 'dinersclub',
    maestro:    'maestro',
    // laser is also supported by buy-ondemand, but it appears to no longer exist IRL
}

const BUY_ONDEMAND_CARD_TYPE_FROM_MODULE = {
    [creditCardType.types.VISA]:             BUY_ONDEMAND_CARD_TYPE.visa,
    [creditCardType.types.AMERICAN_EXPRESS]: BUY_ONDEMAND_CARD_TYPE.amex,
    [creditCardType.types.MASTERCARD]:       BUY_ONDEMAND_CARD_TYPE.mastercard,
    [creditCardType.types.DISCOVER]:         BUY_ONDEMAND_CARD_TYPE.discover,
    [creditCardType.types.UNIONPAY]:         BUY_ONDEMAND_CARD_TYPE.unionpay,
    [creditCardType.types.JCB]:              BUY_ONDEMAND_CARD_TYPE.jcb,
    [creditCardType.types.DINERS_CLUB]:      BUY_ONDEMAND_CARD_TYPE.dinersclub,
    [creditCardType.types.MAESTRO]:          BUY_ONDEMAND_CARD_TYPE.maestro,
}

export interface ICardTypeData {
    type: string;
    cvcLength: number;
}

export const getCardType = (cardNumber: string): ICardTypeData | null => {
    const possibleCards = creditCardType(cardNumber);

    for (const possibleCard of possibleCards) {
        const cardType = BUY_ONDEMAND_CARD_TYPE_FROM_MODULE[possibleCard.type];

        if (cardType != null) {
            return {
                type:      cardType,
                cvcLength: possibleCard.code.size
            };
        }
    }

    return null;
}