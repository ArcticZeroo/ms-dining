import { usePrismaClient } from '../client.js';
import { IMenuItemTag } from '../../../models/cafe.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';

export abstract class TagStorageClient {
    private static readonly _tagNamesById = new Map<string, string>();

    public static resetCache() {
        this._tagNamesById.clear();
    }

    public static async retrieveTagsAsync(): Promise<Map<string, string>> {
        if (this._tagNamesById.size === 0) {
            const tags = await usePrismaClient(prismaClient => prismaClient.menuItemTag.findMany({}));
            for (const tag of tags) {
                this._tagNamesById.set(tag.id, tag.name);
            }
        }

        return this._tagNamesById;
    }

    public static async createTags(tags: IMenuItemTag[]): Promise<void> {
        await usePrismaClient(async prismaClient => {
            for (const tag of tags) {
                try {
                    await prismaClient.menuItemTag.create({ data: tag });
                    this._tagNamesById.set(tag.id, tag.name);
                } catch (err) {
                    if (isUniqueConstraintFailedError(err)) {
                        continue;
                    }

                    throw err;
                }
            }
        });
    }
}