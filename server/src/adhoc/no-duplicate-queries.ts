import { SEARCH_THREAD_HANDLER } from '../api/worker-thread/search.js';

console.log('Clearing duplicated queries...');
await SEARCH_THREAD_HANDLER.sendRequest('clearDuplicatedQueries', {});
console.log('Done clearing duplicated queries.');
process.exit();