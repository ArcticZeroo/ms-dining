import { getAllSearchQueries } from '../worker/data/storage/vector/client.js';

const queries = await getAllSearchQueries();
console.log(queries);