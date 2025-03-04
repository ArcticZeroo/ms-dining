import SemaphoreModule from 'semaphore-async-await';

// When we added openai we had to change module resolution to node, which apparently breaks semaphore for some reason?
// @ts-ignore
export const Lock = SemaphoreModule.Lock;
// @ts-ignore
export const Semaphore = SemaphoreModule.default;