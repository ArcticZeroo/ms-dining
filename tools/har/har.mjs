#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ── Argument Parsing ────────────────────────────────────────────────────────

const parseArguments = (argv) => {
    const args = argv.slice(2);
    const command = args[0];
    const positional = [];
    const flags = {};

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next === undefined || next.startsWith('--')) {
                flags[key] = true;
            } else {
                flags[key] = next;
                i++;
            }
        } else {
            positional.push(arg);
        }
    }

    return { command, positional, flags };
};

// ── HAR Loading ─────────────────────────────────────────────────────────────

const loadHar = async (filePath) => {
    const absolutePath = resolve(filePath);
    const raw = await readFile(absolutePath, 'utf-8');
    const har = JSON.parse(raw);

    if (!har.log || !Array.isArray(har.log.entries)) {
        throw new Error('Invalid HAR file: missing log.entries');
    }

    return har.log;
};

const getEntry = (log, indexString) => {
    const index = parseInt(indexString, 10);
    if (Number.isNaN(index) || index < 0 || index >= log.entries.length) {
        throw new Error(`Invalid entry index: ${indexString} (valid range: 0-${log.entries.length - 1})`);
    }
    return { entry: log.entries[index], index };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const extractDomain = (url) => {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
};

const extractPath = (url) => {
    try {
        const parsed = new URL(url);
        return parsed.pathname + parsed.search;
    } catch {
        return url;
    }
};

const formatBytes = (bytes) => {
    if (bytes == null || bytes < 0) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
    const value = bytes / Math.pow(1000, unitIndex);
    return `${unitIndex === 0 ? value : value.toFixed(1)} ${units[unitIndex]}`;
};

const formatMs = (ms) => {
    if (ms == null || ms < 0) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

const truncate = (string, maxLength) => {
    if (string.length <= maxLength) return string;
    return string.slice(0, maxLength - 1) + '…';
};

const padRight = (string, width) => string.padEnd(width);
const padLeft = (string, width) => string.padStart(width);

// ── Commands ────────────────────────────────────────────────────────────────

const commandInfo = async (log) => {
    const entries = log.entries;
    const domains = new Set(entries.map(entry => extractDomain(entry.request.url)));
    const timestamps = entries
        .map(entry => entry.startedDateTime)
        .filter(Boolean)
        .sort();

    const methods = {};
    const statusBuckets = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, 'other': 0 };

    for (const entry of entries) {
        const method = entry.request.method;
        methods[method] = (methods[method] || 0) + 1;

        const status = entry.response.status;
        if (status >= 200 && status < 300) statusBuckets['2xx']++;
        else if (status >= 300 && status < 400) statusBuckets['3xx']++;
        else if (status >= 400 && status < 500) statusBuckets['4xx']++;
        else if (status >= 500 && status < 600) statusBuckets['5xx']++;
        else statusBuckets['other']++;
    }

    const totalSize = entries.reduce((sum, entry) => {
        const size = entry.response?.content?.size;
        return sum + (size > 0 ? size : 0);
    }, 0);

    console.log('HAR File Info');
    console.log('─'.repeat(50));
    console.log(`  Version:      ${log.version || 'unknown'}`);
    console.log(`  Creator:      ${log.creator?.name || 'unknown'} ${log.creator?.version || ''}`);
    console.log(`  Pages:        ${log.pages?.length ?? 0}`);
    console.log(`  Entries:      ${entries.length}`);
    console.log(`  Total size:   ${formatBytes(totalSize)}`);

    if (timestamps.length > 0) {
        console.log(`  First entry:  ${timestamps[0]}`);
        console.log(`  Last entry:   ${timestamps[timestamps.length - 1]}`);
    }

    console.log(`  Methods:      ${Object.entries(methods).map(([method, count]) => `${method}(${count})`).join(', ')}`);
    console.log(`  Statuses:     ${Object.entries(statusBuckets).filter(([, count]) => count > 0).map(([bucket, count]) => `${bucket}(${count})`).join(', ')}`);
    console.log(`  Domains (${domains.size}):`);

    for (const domain of [...domains].sort()) {
        const count = entries.filter(entry => extractDomain(entry.request.url) === domain).length;
        console.log(`    ${domain} (${count})`);
    }
};

const commandList = async (log, flags) => {
    let entries = log.entries.map((entry, index) => ({ entry, index }));

    if (flags.domain) {
        const pattern = new RegExp(flags.domain, 'i');
        entries = entries.filter(({ entry }) => pattern.test(extractDomain(entry.request.url)));
    }

    if (flags.status) {
        const status = parseInt(flags.status, 10);
        entries = entries.filter(({ entry }) => entry.response.status === status);
    }

    if (flags.method) {
        const method = flags.method.toUpperCase();
        entries = entries.filter(({ entry }) => entry.request.method === method);
    }

    if (flags.type) {
        const pattern = new RegExp(flags.type, 'i');
        entries = entries.filter(({ entry }) => pattern.test(entry.response?.content?.mimeType || ''));
    }

    if (flags['has-body']) {
        entries = entries.filter(({ entry }) => {
            const text = entry.response?.content?.text;
            return text != null && text.length > 0;
        });
    }

    if (entries.length === 0) {
        console.log('No entries match the given filters.');
        return;
    }

    const indexWidth = String(log.entries.length - 1).length;

    console.log(`${padLeft('#', indexWidth)}  METHOD  STATUS  SIZE        TYPE                  URL`);
    console.log('─'.repeat(120));

    for (const { entry, index } of entries) {
        const method = padRight(entry.request.method, 6);
        const status = padLeft(String(entry.response.status), 3);
        const size = padLeft(formatBytes(entry.response?.content?.size), 10);
        const mimeType = padRight(truncate(entry.response?.content?.mimeType || '-', 20), 20);
        const url = extractPath(entry.request.url);

        console.log(`${padLeft(String(index), indexWidth)}  ${method}  ${status}     ${size}  ${mimeType}  ${url}`);
    }

    console.log('─'.repeat(120));
    console.log(`${entries.length} entries${entries.length < log.entries.length ? ` (filtered from ${log.entries.length})` : ''}`);
};

const commandSearch = async (log, pattern, flags) => {
    const searchBody = flags.body === true;
    const regexFlags = flags['case-sensitive'] ? '' : 'i';
    const regex = new RegExp(pattern, regexFlags);

    const matches = [];
    const indexWidth = String(log.entries.length - 1).length;

    for (let i = 0; i < log.entries.length; i++) {
        const entry = log.entries[i];

        if (searchBody) {
            const responseBody = entry.response?.content?.text || '';
            const requestBody = entry.request?.postData?.text || '';
            if (regex.test(responseBody) || regex.test(requestBody)) {
                matches.push({ entry, index: i });
            }
        } else {
            if (regex.test(entry.request.url)) {
                matches.push({ entry, index: i });
            }
        }
    }

    if (matches.length === 0) {
        console.log(`No entries match pattern: ${pattern}${searchBody ? ' (searching bodies)' : ''}`);
        return;
    }

    console.log(`${matches.length} match${matches.length === 1 ? '' : 'es'} for: ${pattern}${searchBody ? ' (in bodies)' : ''}`);
    console.log('─'.repeat(120));

    for (const { entry, index } of matches) {
        const method = padRight(entry.request.method, 6);
        const status = padLeft(String(entry.response.status), 3);
        const size = padLeft(formatBytes(entry.response?.content?.size), 10);
        const url = entry.request.url;

        console.log(`${padLeft(String(index), indexWidth)}  ${method}  ${status}  ${size}  ${url}`);
    }
};

const commandHeaders = async (log, indexString, flags) => {
    const { entry, index } = getEntry(log, indexString);
    const showRequest = flags.request || (!flags.request && !flags.response);
    const showResponse = flags.response || (!flags.request && !flags.response);

    console.log(`Entry ${index}: ${entry.request.method} ${entry.request.url}`);
    console.log('');

    if (showRequest) {
        console.log('Request Headers');
        console.log('─'.repeat(60));
        for (const header of entry.request.headers) {
            console.log(`  ${header.name}: ${header.value}`);
        }
        console.log('');
    }

    if (showResponse) {
        console.log(`Response Headers (${entry.response.status} ${entry.response.statusText})`);
        console.log('─'.repeat(60));
        for (const header of entry.response.headers) {
            console.log(`  ${header.name}: ${header.value}`);
        }
    }
};

const commandBody = async (log, indexString, flags) => {
    const { entry, index } = getEntry(log, indexString);
    const showRequest = flags.request === true;

    let body;
    let label;

    if (showRequest) {
        body = entry.request?.postData?.text || '';
        label = 'Request';
    } else {
        body = entry.response?.content?.text || '';
        label = 'Response';
    }

    if (!body) {
        console.log(`Entry ${index}: No ${label.toLowerCase()} body`);
        return;
    }

    if (flags.pretty) {
        try {
            body = JSON.stringify(JSON.parse(body), null, 2);
        } catch {
            // Not JSON, leave as-is
        }
    }

    if (flags.out) {
        const outPath = resolve(flags.out);
        await writeFile(outPath, body, 'utf-8');
        console.log(`${label} body for entry ${index} written to: ${outPath} (${formatBytes(body.length)})`);
        return;
    }

    console.log(`Entry ${index}: ${entry.request.method} ${entry.request.url}`);
    console.log(`${label} Body (${formatBytes(body.length)}, ${showRequest ? entry.request?.postData?.mimeType || 'unknown' : entry.response?.content?.mimeType || 'unknown'})`);
    console.log('─'.repeat(80));
    console.log(body);
};

const commandTiming = async (log, indexString) => {
    const { entry, index } = getEntry(log, indexString);
    const timings = entry.timings || {};

    console.log(`Entry ${index}: ${entry.request.method} ${entry.request.url}`);
    console.log(`Total time: ${formatMs(entry.time)}`);
    console.log('─'.repeat(40));

    const phases = [
        ['blocked',  timings.blocked],
        ['dns',      timings.dns],
        ['connect',  timings.connect],
        ['ssl',      timings.ssl],
        ['send',     timings.send],
        ['wait',     timings.wait],
        ['receive',  timings.receive],
    ];

    const maxLabel = Math.max(...phases.map(([label]) => label.length));

    for (const [label, value] of phases) {
        const ms = value != null && value >= 0 ? value : -1;
        const bar = ms > 0 ? '█'.repeat(Math.min(Math.ceil(ms / 10), 50)) : '';
        console.log(`  ${padRight(label, maxLabel)}  ${padLeft(formatMs(ms), 8)}  ${bar}`);
    }
};

// ── Usage ───────────────────────────────────────────────────────────────────

const printUsage = () => {
    console.log(`
HAR File Analyzer

Usage: node har.mjs <command> <file.har> [options]

Commands:
  info     <file>                   Show HAR metadata (version, creator, domains, etc.)
  list     <file> [filters]         List all entries in tabular format
  search   <file> <pattern> [opts]  Search entries by URL or body content (regex)
  headers  <file> <index> [opts]    Show request/response headers for an entry
  body     <file> <index> [opts]    Extract request or response body
  timing   <file> <index>           Show timing breakdown for an entry

List filters:
  --domain <pattern>    Filter by domain (regex)
  --status <code>       Filter by HTTP status code
  --method <method>     Filter by HTTP method (GET, POST, etc.)
  --type <pattern>      Filter by MIME type (regex)
  --has-body            Only show entries with a response body

Search options:
  --body                Search response/request bodies instead of URLs
  --case-sensitive      Use case-sensitive matching (default: case-insensitive)

Headers options:
  --request             Show only request headers
  --response            Show only response headers

Body options:
  --request             Show request body instead of response body
  --pretty              Pretty-print JSON bodies
  --out <file>          Write body to a file instead of stdout

Examples:
  node har.mjs info trace.har
  node har.mjs list trace.har --method POST --status 200
  node har.mjs search trace.har "api/sites" --body
  node har.mjs headers trace.har 5
  node har.mjs body trace.har 12 --pretty
  node har.mjs timing trace.har 3
`.trim());
};

// ── Main ────────────────────────────────────────────────────────────────────

const main = async () => {
    const { command, positional, flags } = parseArguments(process.argv);

    if (!command || command === 'help' || flags.help) {
        printUsage();
        process.exit(0);
    }

    const filePath = positional[0];
    if (!filePath) {
        console.error('Error: No HAR file specified.');
        console.error('Usage: node har.mjs <command> <file.har> [options]');
        process.exit(1);
    }

    let log;
    try {
        log = await loadHar(filePath);
    } catch (error) {
        console.error(`Error loading HAR file: ${error.message}`);
        process.exit(1);
    }

    switch (command) {
        case 'info':
            await commandInfo(log);
            break;
        case 'list':
        case 'ls':
            await commandList(log, flags);
            break;
        case 'search':
        case 'grep':
            if (!positional[1]) {
                console.error('Error: No search pattern specified.');
                process.exit(1);
            }
            await commandSearch(log, positional[1], flags);
            break;
        case 'headers':
        case 'hdr':
            if (!positional[1]) {
                console.error('Error: No entry index specified.');
                process.exit(1);
            }
            await commandHeaders(log, positional[1], flags);
            break;
        case 'body':
            if (!positional[1]) {
                console.error('Error: No entry index specified.');
                process.exit(1);
            }
            await commandBody(log, positional[1], flags);
            break;
        case 'timing':
        case 'time':
            if (!positional[1]) {
                console.error('Error: No entry index specified.');
                process.exit(1);
            }
            await commandTiming(log, positional[1]);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            printUsage();
            process.exit(1);
    }
};

main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
