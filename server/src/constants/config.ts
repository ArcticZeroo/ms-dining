import path from 'path';
import { getDirname } from '../util/node.js';

export const webserverPort = 3002;

export const rootFolderPath = path.resolve(getDirname(import.meta.url), '../../../');

export const clientFolderDistPath = path.join(rootFolderPath, 'client', 'dist');

export const clientIndexHtmlPath = path.join(clientFolderDistPath, 'index.html');

export const requestRetryCount = 3;