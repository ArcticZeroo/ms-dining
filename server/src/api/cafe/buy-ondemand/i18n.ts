import { Response } from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../../constants/cafes.js';
import { logError, logInfo } from '../../../util/log.js';
import type { BuyOnDemandClient } from './buy-ondemand-client.js';

const BUY_ONDEMAND_PROJECT_ID = '838d5fce-27b5-4368-8c54-8fcb33577f9a';
const TRANSLATION_VERSION = 'production';
const DEFAULT_LOCALE = 'en';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
    promise: Promise<Map<string, string>>;
    fetchedAt: number;
}

export class TranslationCache {
    readonly #entries = new Map<string /*cafeId*/, CacheEntry>();
    readonly #ttlMs: number;

    constructor(ttlMs: number = DEFAULT_TTL_MS) {
        this.#ttlMs = ttlMs;
    }

    async retrieveAsync(client: BuyOnDemandClient): Promise<Map<string, string>> {
        const cafeId = client.cafe.id;
        const existing = this.#entries.get(cafeId);
        if (existing != null && Date.now() - existing.fetchedAt < this.#ttlMs) {
            return existing.promise;
        }

        const fetchedAt = Date.now();
        const promise = this.#fetch(client);
        const entry: CacheEntry = { promise, fetchedAt };
        this.#entries.set(cafeId, entry);

        // Evict the entry on rejection so the next call retries instead of
        // returning a sticky rejected promise. Guard against clobbering a
        // newer entry installed by a concurrent retry/clear.
        promise.catch(() => {
            if (this.#entries.get(cafeId) === entry) {
                this.#entries.delete(cafeId);
            }
        });

        return promise;
    }

    clear(cafeId?: string): void {
        if (cafeId != null) {
            this.#entries.delete(cafeId);
        } else {
            this.#entries.clear();
        }
    }

    async #fetch(client: BuyOnDemandClient): Promise<Map<string, string>> {
        const host = new URL(getBaseApiUrlWithoutTrailingSlash(client.cafe)).host;
        const coreNamespace = 'core';
        const domainNamespace = `domain-${host}`;

        const [coreMap, domainMap] = await Promise.all([
            this.#fetchNamespace(client, coreNamespace),
            this.#fetchNamespace(client, domainNamespace),
        ]);

        // Domain overrides core, mirroring how the BoD frontend layers namespaces.
        const merged = new Map<string, string>(coreMap);
        for (const [code, message] of domainMap) {
            merged.set(code, message);
        }

        logInfo(`[i18n] Fetched ${merged.size} translation entries for ${client.cafe.id}`);
        return merged;
    }

    async #fetchNamespace(client: BuyOnDemandClient, namespace: string): Promise<Map<string, string>> {
        const path = `/translation/language/${DEFAULT_LOCALE}/ns/${namespace}/?projectId=${BUY_ONDEMAND_PROJECT_ID}&version=${TRANSLATION_VERSION}`;
        const response: Response = await client.requestAsync(path);
        const json = await response.json() as unknown;

        if (json == null || typeof json !== 'object') {
            throw new Error(`Translation endpoint for ${namespace} returned non-object: ${typeof json}`);
        }

        const map = new Map<string, string>();
        for (const [key, value] of Object.entries(json)) {
            if (typeof value === 'string') {
                map.set(key, value);
            }
        }
        return map;
    }
}
