import type { ISerializedModifier } from '../models/shared.js';

/** Single modifier row as stored in Prisma (one row per modifier+choice pair). */
export interface ModifierRow {
    modifierId: string;
    choiceId: string;
}

/** Group flat Prisma modifier rows into the serialized format. */
export const groupModifierRows = (rows: ModifierRow[]): ISerializedModifier[] => {
    const byModifier = new Map<string, string[]>();
    for (const { modifierId, choiceId } of rows) {
        const existing = byModifier.get(modifierId);
        if (existing) {
            existing.push(choiceId);
        } else {
            byModifier.set(modifierId, [choiceId]);
        }
    }
    return Array.from(byModifier, ([modifierId, choiceIds]) => ({ modifierId, choiceIds }));
};

/** Flatten grouped modifiers into individual Prisma rows. */
export const flattenModifiers = (modifiers: ISerializedModifier[]): ModifierRow[] =>
    modifiers.flatMap(mod => mod.choiceIds.map(choiceId => ({ modifierId: mod.modifierId, choiceId })));

/** Check if grouped modifiers match flat Prisma rows (order-independent). */
export const modifiersEqual = (grouped: ISerializedModifier[], rows: ModifierRow[]): boolean => {
    const normalize = (pairs: Array<{ modifierId: string; choiceId: string }>) =>
        pairs.map(p => `${p.modifierId}:${p.choiceId}`).sort();

    const left = normalize(flattenModifiers(grouped));
    const right = normalize(rows);
    return left.length === right.length && left.every((v, i) => v === right[i]);
};
