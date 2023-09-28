import Koa from 'koa';
import json from 'koa-json';
import { registerRoutes } from './routes/register.js';
import serve from 'koa-static';
import { clientFolderDistPath, clientIndexHtmlPath, serverStaticPath } from './constants/config.js';
import mount from 'koa-mount';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

const app = new Koa();

app.use(json());

registerRoutes(app);

app.use(mount('/static', serve(serverStaticPath)));
app.use(mount('/', serve(clientFolderDistPath)));

app.use(async (ctx) => {
    const stats = await fsPromises.stat(clientIndexHtmlPath);
    ctx.type = 'html';
    ctx.set('Content-Length', stats.size.toString());
    ctx.body = fs.createReadStream(clientIndexHtmlPath);
});

export { app };