---
name: har-analysis
description: Analyze HAR (HTTP Archive) files using the CLI tool at tools/har/har.mjs. Use when asked about HAR files, network traces, HTTP request/response inspection, or API traffic analysis.
---

# HAR File Analysis

Use the CLI tool at `tools/har/har.mjs` to analyze HAR files. Do not write ad-hoc scripts to parse HAR files.

## Running the tool

```bash
node tools/har/har.mjs <command> <file.har> [options]
```

## Available commands

| Command | Usage | Description |
|---------|-------|-------------|
| `info` | `info <file>` | Show metadata: version, creator, domains, entry count, date range |
| `list` | `list <file> [--domain X] [--status N] [--method M] [--type T] [--has-body]` | List entries with optional filters |
| `search` | `search <file> <pattern> [--body] [--case-sensitive]` | Search entries by URL regex (or body with `--body`) |
| `headers` | `headers <file> <index> [--request \| --response]` | Show request/response headers for entry at index |
| `body` | `body <file> <index> [--request] [--pretty] [--out FILE]` | Extract body content; `--pretty` for JSON formatting |
| `timing` | `timing <file> <index>` | Show timing breakdown (DNS, connect, SSL, wait, etc.) |

## Typical workflow

1. Start with `info` to understand the HAR file
2. Use `list` with filters or `search` to find the entry you need
3. Use `headers`, `body`, or `timing` with the entry index from step 2

## Notes

- Entry indices shown by `list` and `search` are stable — use them with `headers`, `body`, and `timing`
- Search patterns are regex and case-insensitive by default
- `--pretty` auto-detects and formats JSON; non-JSON bodies are shown as-is
- `--out` writes body to a file instead of stdout (useful for large payloads)
- Command aliases: `ls`=`list`, `grep`=`search`, `hdr`=`headers`, `time`=`timing`
