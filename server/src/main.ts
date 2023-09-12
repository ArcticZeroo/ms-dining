import { app } from './app.js';
import { webserverPort } from './constants/config.js';

console.log('Starting server on port', webserverPort);
app.listen(webserverPort);