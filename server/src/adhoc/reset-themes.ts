import { usePrismaClient } from '../api/storage/client.js';

console.log('Clearing themes...');
console.time('Clear Themes');
await usePrismaClient(client => client.stationTheme.deleteMany({}));
console.timeEnd('Clear Themes');