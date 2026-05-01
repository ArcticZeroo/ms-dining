import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseClassificationResponse, hashShutdownMessage } from '../../../api/cafe/shutdown-classifier.js';

describe('hashShutdownMessage', () => {
	it('returns consistent hash for the same message', () => {
		const msg = 'This location is closed today.';
		assert.equal(hashShutdownMessage(msg), hashShutdownMessage(msg));
	});

	it('returns different hashes for different messages', () => {
		assert.notEqual(
			hashShutdownMessage('Closed today'),
			hashShutdownMessage('Closed tomorrow')
		);
	});
});

describe('parseClassificationResponse', () => {
	it('parses a full shutdown from XML tags', () => {
		const result = parseClassificationResponse(
			'<shutdown-classification>{"shutdownType":"full","isTemporary":false,"resumeInfo":null}</shutdown-classification>'
		);

		assert.equal(result.shutdownType, 'full');
		assert.equal(result.isTemporary, false);
		assert.equal(result.resumeInfo, null);
	});

	it('parses an online-ordering-only response from XML tags', () => {
		const result = parseClassificationResponse(
			'<shutdown-classification>{"shutdownType":"online_ordering_only","isTemporary":true,"resumeInfo":"Back at 2 PM"}</shutdown-classification>'
		);

		assert.equal(result.shutdownType, 'online_ordering_only');
		assert.equal(result.isTemporary, true);
		assert.equal(result.resumeInfo, 'Back at 2 PM');
	});

	it('extracts JSON from XML tags with surrounding reasoning text', () => {
		const response = 'The message indicates the cafe is open for in-person visits.\n<shutdown-classification>\n{"shutdownType":"online_ordering_only","isTemporary":true,"resumeInfo":"Visit in person"}\n</shutdown-classification>\nHope this helps!';
		const result = parseClassificationResponse(response);

		assert.equal(result.shutdownType, 'online_ordering_only');
		assert.equal(result.isTemporary, true);
		assert.equal(result.resumeInfo, 'Visit in person');
	});

	it('throws when no XML tags are present', () => {
		assert.throws(
			() => parseClassificationResponse('I cannot classify this message.'),
			/No <shutdown-classification> tag found/
		);
	});

	it('throws when only raw JSON is present without XML tags', () => {
		assert.throws(
			() => parseClassificationResponse('{"shutdownType":"full","isTemporary":true,"resumeInfo":"Reopens Monday"}'),
			/No <shutdown-classification> tag found/
		);
	});

	it('throws when JSON is in markdown code blocks without XML tags', () => {
		assert.throws(
			() => parseClassificationResponse('```json\n{"shutdownType":"full","isTemporary":true,"resumeInfo":"Reopens Monday"}\n```'),
			/No <shutdown-classification> tag found/
		);
	});

	it('sets resumeInfo to null when isTemporary is false even if provided', () => {
		const result = parseClassificationResponse(
			'<shutdown-classification>{"shutdownType":"full","isTemporary":false,"resumeInfo":"Some info"}</shutdown-classification>'
		);

		assert.equal(result.resumeInfo, null);
	});

	it('throws on invalid shutdownType', () => {
		assert.throws(
			() => parseClassificationResponse('<shutdown-classification>{"shutdownType":"unknown","isTemporary":false,"resumeInfo":null}</shutdown-classification>'),
			/failed validation/
		);
	});

	it('throws when no JSON or tags are present', () => {
		assert.throws(
			() => parseClassificationResponse('I cannot classify this message.'),
			/No <shutdown-classification> tag found/
		);
	});

	it('rejects resumeInfo longer than 60 characters', () => {
		const longResume = 'A'.repeat(61);
		assert.throws(
			() => parseClassificationResponse(
				`<shutdown-classification>{"shutdownType":"full","isTemporary":true,"resumeInfo":"${longResume}"}</shutdown-classification>`
			),
			/failed validation/
		);
	});

	it('handles missing resumeInfo field (defaults to null)', () => {
		const result = parseClassificationResponse(
			'<shutdown-classification>{"shutdownType":"full","isTemporary":false}</shutdown-classification>'
		);

		assert.equal(result.resumeInfo, null);
	});

	it('handles undefined resumeInfo field when temporary', () => {
		const result = parseClassificationResponse(
			'<shutdown-classification>{"shutdownType":"full","isTemporary":true}</shutdown-classification>'
		);

		assert.equal(result.resumeInfo, null);
	});
});
