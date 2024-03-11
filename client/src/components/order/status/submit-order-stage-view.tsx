import { SUBMIT_ORDER_STAGES_IN_ORDER, SubmitOrderStage } from '@msdining/common/dist/models/cart';
import React from 'react';

const LAST_COMPLETED_STAGE_NICE_TEXT = {
    [SubmitOrderStage.notStarted]: 'Not Started',
    [SubmitOrderStage.addToCart]: 'Adding to cart (Step 1/5)',
    [SubmitOrderStage.initializeCardProcessor]: 'Starting card processor (Step 2/5)',
    [SubmitOrderStage.payment]: 'Payment (Step 3/5)',
    [SubmitOrderStage.closeOrder]: 'Sending order info to kitchen (Step 4/5)',
    [SubmitOrderStage.sendTextReceipt]: 'Sending SMS receipt (Step 5/5)',
    [SubmitOrderStage.complete]: 'Complete',
}

interface ISubmitOrderStageViewProps {
    lastCompletedStage: SubmitOrderStage;
}

export const SubmitOrderStageView: React.FC<ISubmitOrderStageViewProps> = ({ lastCompletedStage }) => {
    const lastCompletedStageIndex = SUBMIT_ORDER_STAGES_IN_ORDER.indexOf(lastCompletedStage);
    console.log(lastCompletedStage, lastCompletedStageIndex, SUBMIT_ORDER_STAGES_IN_ORDER, LAST_COMPLETED_STAGE_NICE_TEXT);

    return (
        <div className="flex-col">
            {
                lastCompletedStage !== SubmitOrderStage.complete && (
                    <span>
                        Unfortunately, your order could not be completed.
                    </span>
                )
            }
            <div className="flex flex-center">
                <table className="chip default-table">
                    <tbody>
                        {
                            SUBMIT_ORDER_STAGES_IN_ORDER.map((stage, currentStageIndex) => (
                                <tr key={stage}>
                                    <td className="text-left">{LAST_COMPLETED_STAGE_NICE_TEXT[stage]}</td>
                                    <td>{currentStageIndex <= lastCompletedStageIndex ? '✅' : '❌'}</td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
}