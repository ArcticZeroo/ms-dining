/**
 * Exhaustive switch guard. Place in the `default` case of a switch statement
 * over a discriminated union to get a compile-time error if a variant is
 * unhandled.
 *
 * @example
 * switch (state.status) {
 *     case 'a': return handleA();
 *     case 'b': return handleB();
 *     default:  throw preventUnhandledDefault(state);
 * }
 */
export const preventUnhandledDefault = (value: never): Error => {
    return new Error(`Unhandled case: ${JSON.stringify(value)}`);
};
