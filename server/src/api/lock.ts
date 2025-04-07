import * as SemaphoreModule from 'semaphore-async-await';

// When we added openai we had to change module resolution to node, which apparently breaks semaphore for some reason?
export const Lock = SemaphoreModule.Lock;

// @ts-expect-error - this is insane
export const Semaphore: SemaphoreModule = SemaphoreModule.default.default;