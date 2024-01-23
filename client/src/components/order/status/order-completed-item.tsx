import { CafeView } from '../../../models/cafe.ts';
import { IOrderCompletionData, SubmitOrderStage } from '@msdining/common/dist/models/cart';
import React from 'react';
import { classNames } from '../../../util/react.ts';

const LAST_COMPLETED_STAGE_NICE_TEXT = {
    [SubmitOrderStage.notStarted]: 'Not Started',
    [SubmitOrderStage.addToCart]: 'Adding to cart (Step 1/4)',
    [SubmitOrderStage.payment]: 'Payment (Step 2/4)',
    [SubmitOrderStage.closeOrder]: 'Sending order to kitchen after payment (Step 3/4)',
    [SubmitOrderStage.sendTextReceipt]: 'Sending SMS receipt after payment (Step 4/4)',
    [SubmitOrderStage.complete]: 'Complete',
}

interface IOrderCompletedItemProps {
    view: CafeView;
    result: IOrderCompletionData;
}

export const OrderCompletedItem: React.FC<IOrderCompletedItemProps> = ({ view, result }) => {
    const isSuccess = result.lastCompletedStage === SubmitOrderStage.complete;

    return (
        <div key={view.value.id} className={classNames('card', isSuccess ? 'dark-blue' : 'error')}>
            <div className="title">
                {view.value.name}
            </div>
            {
                !isSuccess && (
                    <div>
                        Your order was not successfully completed. The last step that was completed was:
                        {LAST_COMPLETED_STAGE_NICE_TEXT[result.lastCompletedStage]}
                    </div>
                )
            }
            {
                isSuccess && (
                    <div>
                        Your order was successfully submitted! You should receive a text message with order updates.
                    </div>
                )
            }
            <div>
                Estimated wait time: {result.waitTimeMin} - {result.waitTimeMax} minutes
            </div>
            <div>
                {result.lastCompletedStage === SubmitOrderStage.complete && `Order #${result.orderNumber}`}
            </div>
        </div>
    );
};