import { usePrismaWrite } from '../api/storage/client.js';

console.log('Deleting all cross-cafe group entries...');

const result = await usePrismaWrite(prisma => {
    return prisma.crossCafeGroup.deleteMany({});
});

console.log(`Deleted ${result.count} cross-cafe group entries.`);