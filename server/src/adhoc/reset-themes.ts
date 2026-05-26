import { usePrismaWrite } from '../worker/data/storage/client.js';

console.log('Clearing themes...');
console.time('Clear Themes');
await usePrismaWrite(client => client.stationTheme.deleteMany({}));
console.timeEnd('Clear Themes');