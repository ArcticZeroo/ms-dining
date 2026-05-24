/**
 * Exhaustive switch guard. Throw in the `default` case of a switch statement
 * over a discriminated union to get a compile-time error if a variant is
 * unhandled.
 *
 * @example
 * switch (state.status) {
 *     case 'a': return handleA();
 *     case 'b': return handleB();
 *     default:  throw new UnhandledDefaultError(state);
 * }
 */
export class UnhandledDefaultError extends Error {
    constructor(value: never) {
        super(`Unhandled case: ${JSON.stringify(value)}`);
        this.name = 'UnhandledDefaultError';
    }
}
