import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { logError, logInfo } from '../../../util/log.js';

const MANIFEST_PATH = path.join(serverMenuItemThumbnailPath, 'manifest.json');

export interface IManifestEntry {
	hash: string;
	width: number;
	height: number;
	lastUpdateTime: string;
}

export type ThumbnailManifest = Record<string, IManifestEntry>;

let manifest: ThumbnailManifest = {};

export const getManifest = (): ThumbnailManifest => manifest;

export const loadManifest = async (): Promise<ThumbnailManifest> => {
	try {
		const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
		manifest = JSON.parse(data) as ThumbnailManifest;
		logInfo(`[Manifest] Loaded manifest with ${Object.keys(manifest).length} entries`);
	} catch {
		logInfo('[Manifest] No existing manifest found, starting fresh');
		manifest = {};
	}
	return manifest;
};

export const saveManifest = async (): Promise<void> => {
	try {
		await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
		await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
	} catch (err) {
		logError('[Manifest] Failed to save manifest:', err);
	}
};

export const updateManifestEntry = (id: string, entry: IManifestEntry): void => {
	manifest[id] = entry;
};

export const removeManifestEntry = (id: string): void => {
	delete manifest[id];
};
