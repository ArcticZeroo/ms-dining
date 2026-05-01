import { z } from 'zod';
import { retrieveTextCompletion } from '../ai/index.js';
import { LockedMap } from '../lock/map.js';
import { logDebug, logError } from '../../util/log.js';
import { sha256 } from '../../util/hash.js';
import { usePrismaClient } from '../storage/client.js';

export interface IShutdownClassification {
	messageHash: string;
	message: string;
	shutdownType: 'full' | 'online_ordering_only';
	isTemporary: boolean;
	resumeInfo: string | null;
}

const CLASSIFICATION_SCHEMA = z.object({
	shutdownType: z.enum(['full', 'online_ordering_only']),
	isTemporary:  z.boolean(),
	resumeInfo:   z.string().max(60).nullable().optional().default(null),
});

const SYSTEM_PROMPT = `You are a classifier for café shutdown messages at a corporate campus.
Given a shutdown message, determine:
1. Whether the ENTIRE café is closed ("full"), or only online/mobile ordering is unavailable while the café remains open for in-person visits ("online_ordering_only").
2. Whether the shutdown is explicitly temporary (will resume at a known or implied time) or permanent/indefinite.
3. If temporary, a short human-readable summary of when service will resume (e.g. "Reopens Monday", "Back at 2 PM").

Rules:
- If the message mentions the location is open but online ordering is unavailable, use "online_ordering_only".
- If the message says the café/location is closed, not operating, or shut down entirely, use "full".
- "isTemporary" should ONLY be true when the message specifies a concrete time, date, or event for resumption (e.g. "Reopens Monday", "Back after Labor Day", "Returns at 2 PM"). Vague words like "temporarily" without a specific resumption time do NOT make it temporary — set isTemporary to false. It must be explicit that the shutdown is temporary.
- "resumeInfo" must be null when isTemporary is false.
- "resumeInfo" should be a short phrase (under 60 characters) when isTemporary is true.

Respond with your classification inside XML tags. You may include reasoning before the tags, but the tags must contain valid JSON:
<shutdown-classification>
{"shutdownType":"full","isTemporary":false,"resumeInfo":null}
</shutdown-classification>`;

export const hashShutdownMessage = (message: string): string => sha256(message);

export const parseClassificationResponse = (responseText: string): z.infer<typeof CLASSIFICATION_SCHEMA> => {
	const xmlMatch = responseText.match(/<shutdown-classification>(?<json>[\s\S]*?)<\/shutdown-classification>/);

	if (!xmlMatch?.groups?.json) {
		throw new Error(`No <shutdown-classification> tag found in AI response: ${responseText}`);
	}

	const parsed = JSON.parse(xmlMatch.groups.json);
	const result = CLASSIFICATION_SCHEMA.safeParse(parsed);

	if (!result.success) {
		throw new Error(`AI response failed validation: ${result.error.message}`);
	}

	if (!result.data.isTemporary) {
		result.data.resumeInfo = null;
	}

	return result.data;
};

// Calls AI to classify and persists the result to DB. Throws on failure.
const classifyAndPersistAsync = async (messageHash: string, message: string): Promise<IShutdownClassification> => {
	const response = await retrieveTextCompletion({
		systemPrompt: SYSTEM_PROMPT,
		userMessage:  `Classify this café shutdown message:\n\n"${message}"`,
		maxTokens:    256,
	});

	const classification = parseClassificationResponse(response);
	const result: IShutdownClassification = { messageHash, message, ...classification };

	await usePrismaClient(prisma => prisma.cafeShutdown.upsert({
		where:  { messageHash },
		update: {
			shutdownType: result.shutdownType,
			isTemporary:  result.isTemporary,
			resumeInfo:   result.resumeInfo,
		},
		create: {
			messageHash,
			message,
			shutdownType: result.shutdownType,
			isTemporary:  result.isTemporary,
			resumeInfo:   result.resumeInfo,
		},
	}));

	return result;
};

// Ensures only one AI call per unique message hash, even under concurrent discovery
const CLASSIFICATION_CACHE = new LockedMap<string /*messageHash*/, IShutdownClassification>();

export const classifyShutdownMessageAsync = async (message: string): Promise<IShutdownClassification> => {
	const messageHash = hashShutdownMessage(message);

	return CLASSIFICATION_CACHE.getOrInsert(messageHash, async () => {
		// Check DB first
		const existing = await usePrismaClient(prisma => prisma.cafeShutdown.findUnique({
			where: { messageHash },
		}));

		if (existing?.shutdownType) {
			logDebug(`Shutdown message hash ${messageHash} already classified in DB as "${existing.shutdownType}"`);
			return {
				messageHash,
				message:      existing.message,
				shutdownType: existing.shutdownType as IShutdownClassification['shutdownType'],
				isTemporary:  existing.isTemporary ?? false,
				resumeInfo:   existing.resumeInfo ?? null,
			};
		}

		logDebug(`Classifying shutdown message (hash=${messageHash}): "${message.substring(0, 80)}..."`);

		try {
			return await classifyAndPersistAsync(messageHash, message);
		} catch (err) {
			logError(`Failed to classify shutdown message, defaulting to "full":`, err);
			return { messageHash, message, shutdownType: 'full', isTemporary: false, resumeInfo: null };
		}
	});
};
