import { dirname } from 'path';
import { fileURLToPath } from 'url';

export const getDirname = (importUrl: string) => dirname(fileURLToPath(importUrl));
