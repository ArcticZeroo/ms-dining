import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logInfo } from './util/log.js';

logInfo('Starting server on port', webserverPort);
app.listen(webserverPort);