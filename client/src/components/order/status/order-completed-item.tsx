import {
    IOrderCompletionData,
    SUBMIT_ORDER_STAGES_IN_ORDER,
    SubmitOrderStage
} from '@msdining/common/dist/models/cart';
import React, { useMemo } from 'react';
import { CafeView } from '../../../models/cafe.ts';
import { classNames } from '../../../util/react.ts';
import { getViewName } from '../../../util/cafe.ts';
import { SubmitOrderStageView } from './submit-order-stage-view.tsx';

interface IOrderCompletedItemProps {
    view: CafeView;
    result: IOrderCompletionData;
}

export const OrderCompletedItem: React.FC<IOrderCompletedItemProps> = ({ view, result }) => {
    const isSuccess = result.lastCompletedStage === SubmitOrderStage.complete;

    // If the order reached payment stage, we might have failed in the MSDining service but the kitchen could have
    // received the order. In this case, we want to show a message to the user to contact the cafe.
    const isMaybeReceivedByKitchen = useMemo(
        () => {
            const lastCompletedStageIndex = SUBMIT_ORDER_STAGES_IN_ORDER.indexOf(result.lastCompletedStage);
            const paymentStageIndex = SUBMIT_ORDER_STAGES_IN_ORDER.indexOf(SubmitOrderStage.payment);
            return lastCompletedStageIndex >= paymentStageIndex;
        },
        [result]
    );

    return (
        <div key={view.value.id} className={classNames('card', isSuccess ? 'dark-blue' : 'error')}>
            <div className="title">
                {getViewName(view, true /*showGroupName*/)}
                {(isSuccess || isMaybeReceivedByKitchen) && ` - Order #${result.orderNumber}`}
            </div>
            {
                !isSuccess && (
                    <>
                        <SubmitOrderStageView lastCompletedStage={result.lastCompletedStage}/>
                        {
                            isMaybeReceivedByKitchen && (
                                <div>
                                    Even though your order was not successfully completed, it may have been received by the
                                    kitchen. Please contact {view.value.name} for more information.
                                </div>
                            )
                        }
                    </>
                )
            }
            {
                isSuccess && (
                    <>
                        <div>
                            Your order was successfully submitted! You should receive a text message with order updates.
                        </div>
                        <div>
                            Estimated wait time: {result.waitTimeMin} - {result.waitTimeMax} minutes
                        </div>
                    </>
                )
            }
        </div>
    );
};