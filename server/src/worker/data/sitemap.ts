import { SitemapStream } from 'sitemap';
import { serverStaticPath, webserverHost } from '../../shared/constants/config.js';
import { CAFE_GROUP_LIST } from '../../shared/constants/cafes.js';
import { CafeGroup, ICafe } from '../../shared/models/cafe.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logError } from '../../shared/util/log.js';
import { getServices } from '../../main/services/registry.js';

const addMenu = (sitemap: SitemapStream, site: CafeGroup | ICafe) => {
    sitemap.write({ url: `/menu/${site.id}`, changefreq: 'daily', priority: 0.9 });
}

export const generateSitemap = async () => {
    const sitemap = new SitemapStream({ hostname: webserverHost });

    sitemap.write({ url: '/', changefreq: 'daily', priority: 1 });
    sitemap.write({ url: '/info', changefreq: 'monthly', priority: 0.3 });
    sitemap.write({ url: '/settings', changefreq: 'monthly', priority: 0.4 });
    sitemap.write({ url: '/cheap', changefreq: 'daily', priority: 0.7 });

    for (const group of CAFE_GROUP_LIST) {
        if (!group.alwaysExpand) {
            addMenu(sitemap, group);
        }

        for (const cafe of group.members) {
            addMenu(sitemap, cafe);
        }
    }

    const topSearchQueries = await getServices().data.searchQuery.getTopSearchQueries({ limit: 50 });
    for (const { query } of topSearchQueries) {
        sitemap.write({ url: `/search?q=${encodeURIComponent(query)}`, changefreq: 'daily', priority: 0.8 });
    }

    sitemap.end();

    return sitemap;
}

export const generateAndSaveSitemap = async () => {
    try {
        const sitemap = await generateSitemap();

        const writeStream = fs.createWriteStream(path.join(serverStaticPath, 'sitemap.xml'));

        sitemap.pipe(writeStream);
        sitemap.end();
    } catch (err) {
        logError('Error generating sitemap:', err);
    }
}