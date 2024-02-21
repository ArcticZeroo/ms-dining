import { IOrderCompletionData, SubmitOrderStage } from '@msdining/common/dist/models/cart';
import React from 'react';
import { CafeView } from '../../../models/cafe.ts';
import { classNames } from '../../../util/react.ts';
import { getViewName } from '../../../util/cafe.ts';

const LAST_COMPLETED_STAGE_NICE_TEXT = {
    [SubmitOrderStage.notStarted]: 'Not Started',
    [SubmitOrderStage.addToCart]: 'Adding to cart (Step 1/5)',
    [SubmitOrderStage.initializeCardProcessor]: 'Initializing Card Processor (Step 2/5)',
    [SubmitOrderStage.payment]: 'Payment (Step 3/5)',
    [SubmitOrderStage.closeOrder]: 'Sending order to kitchen after payment (Step 4/5)',
    [SubmitOrderStage.sendTextReceipt]: 'Sending SMS receipt after payment (Step 5/5)',
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
                {getViewName(view, true /*showGroupName*/)}
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
                {result.orderNumber && `Order #${result.orderNumber}`}
            </div>
            <div>
                {result.orderNumber && !isSuccess && `Your order may have been received by the cafeteria. Please contact ${view.value.name}.`}
            </div>
        </div>
    );
};