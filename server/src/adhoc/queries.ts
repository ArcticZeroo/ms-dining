import { getAllSearchQueries } from '../api/storage/vector/client.js';

const queries = await getAllSearchQueries();
console.log(queries);