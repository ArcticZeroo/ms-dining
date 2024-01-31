import { SitemapStream } from 'sitemap';
import { serverStaticPath, webserverHost } from '../constants/config.js';
import { groupList } from '../constants/cafes.js';
import { CafeGroup, ICafe } from '../models/cafe.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logError } from '../util/log.js';

const addMenu = (sitemap: SitemapStream, site: CafeGroup | ICafe) => {
    sitemap.write({ url: `/menu/${site.id}`, changefreq: 'daily', priority: 0.9 });
}

export const generateSitemap = () => {
    const sitemap = new SitemapStream({ hostname: webserverHost });
    sitemap.write({ url: '/', changefreq: 'daily', priority: 1 });
    sitemap.write({ url: '/info', changefreq: 'monthly', priority: 0.3 });
    sitemap.write({ url: '/settings', changefreq: 'monthly', priority: 0.4 });
    sitemap.write({ url: '/cheap', changefreq: 'daily', priority: 0.7 });

    for (const group of groupList) {
        if (!group.alwaysExpand) {
            addMenu(sitemap, group);
        }

        for (const cafe of group.members) {
            addMenu(sitemap, cafe);
        }
    }

    sitemap.end();

    return sitemap;
}

export const generateAndSaveSitemap = () => {
    try {
        const sitemap = generateSitemap();

        const writeStream = fs.createWriteStream(path.join(serverStaticPath, 'sitemap.xml'));

        sitemap.pipe(writeStream);
        sitemap.end();
    } catch (err) {
        logError('Error generating sitemap:', err);
    }
}