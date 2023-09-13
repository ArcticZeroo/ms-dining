import Koa from 'koa';
import json from 'koa-json';
import { registerRoutes } from './routes/register.js';
import serve = require('koa-static');
import { clientFolderDistPath } from './constants/config.js';

const app = new Koa();

app.use(json());

registerRoutes(app);

app.use(serve(clientFolderDistPath));

export { app };