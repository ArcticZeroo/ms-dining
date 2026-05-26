import { SEARCH_THREAD_HANDLER } from '../worker/data/threads/search.js';

console.log('Clearing duplicated queries...');
await SEARCH_THREAD_HANDLER.sendRequest('search', 'clearDuplicatedQueries');
console.log('Done clearing duplicated queries.');
process.exit();