import { z } from 'zod';

export interface ISerializedModifier {
    modifierId: string;
    choiceIds: Array<string>;
}

export const SerializedModifierSchema = z.object({
    modifierId: z.string(),
    choiceIds:  z.array(z.string()),
});
