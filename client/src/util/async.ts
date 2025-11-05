import { PromiseStage } from '@arcticzeroo/react-promise-hook';

export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ICancellationToken {
    isCancelled: boolean;
}

export const promiseStageToButtonClass = (stage: PromiseStage): string => {
    switch (stage) {
    case PromiseStage.notRun:
        return '';
    case PromiseStage.running:
        return 'disabled';
    case PromiseStage.success:
        return 'success';
    case PromiseStage.error:
        return 'error';
    }

    throw new Error('Unknown PromiseStage value');
};

export const canUseControllingButton = (stage: PromiseStage): boolean => {
    return stage === PromiseStage.notRun || stage === PromiseStage.error;
}