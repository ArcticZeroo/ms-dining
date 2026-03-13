# HAR File Analyzer

A zero-dependency Node.js CLI for inspecting HAR (HTTP Archive) files.

## Usage

```
node tools/har/har.mjs <command> <file.har> [options]
```

## Commands

### `info` — HAR metadata

```bash
node tools/har/har.mjs info trace.har
```

Shows version, creator, entry count, total size, date range, HTTP method/status distribution, and all domains with request counts.

### `list` — List entries

```bash
# List all entries
node tools/har/har.mjs list trace.har

# Filter by method and status
node tools/har/har.mjs list trace.har --method POST --status 200

# Filter by domain (regex)
node tools/har/har.mjs list trace.har --domain "buy-ondemand"

# Filter by MIME type
node tools/har/har.mjs list trace.har --type "application/json"

# Only entries with response bodies
node tools/har/har.mjs list trace.har --has-body
```

Filters combine with AND logic. Output shows index, method, status, size, MIME type, and URL path.

**Filters:**
| Flag | Description |
|------|-------------|
| `--domain <pattern>` | Filter by domain (regex) |
| `--status <code>` | Filter by exact HTTP status code |
| `--method <method>` | Filter by HTTP method (GET, POST, etc.) |
| `--type <pattern>` | Filter by MIME type (regex) |
| `--has-body` | Only entries with a response body |

### `search` — Search entries

```bash
# Search URLs by regex
node tools/har/har.mjs search trace.har "api/sites"

# Search response/request bodies
node tools/har/har.mjs search trace.har "meatball" --body

# Case-sensitive search
node tools/har/har.mjs search trace.har "API" --case-sensitive
```

**Options:**
| Flag | Description |
|------|-------------|
| `--body` | Search response and request bodies instead of URLs |
| `--case-sensitive` | Case-sensitive matching (default: case-insensitive) |

### `headers` — Show headers

```bash
# Show both request and response headers
node tools/har/har.mjs headers trace.har 5

# Request headers only
node tools/har/har.mjs headers trace.har 5 --request

# Response headers only
node tools/har/har.mjs headers trace.har 5 --response
```

### `body` — Extract body content

```bash
# Show response body
node tools/har/har.mjs body trace.har 12

# Pretty-print JSON
node tools/har/har.mjs body trace.har 12 --pretty

# Show request body instead
node tools/har/har.mjs body trace.har 12 --request

# Save to file
node tools/har/har.mjs body trace.har 12 --pretty --out response.json
```

**Options:**
| Flag | Description |
|------|-------------|
| `--request` | Show request body instead of response |
| `--pretty` | Pretty-print JSON bodies |
| `--out <file>` | Write body to file instead of stdout |

### `timing` — Timing breakdown

```bash
node tools/har/har.mjs timing trace.har 3
```

Shows per-phase timing (blocked, DNS, connect, SSL, send, wait, receive) with a visual bar chart.

## Aliases

Some commands have short aliases:
- `ls` → `list`
- `grep` → `search`
- `hdr` → `headers`
- `time` → `timing`

## Common Workflows

**Find a specific API call and inspect its response:**
```bash
# Find the request
node tools/har/har.mjs search trace.har "concepts"

# Check its response body (use the index from search results)
node tools/har/har.mjs body trace.har 0 --pretty
```

**Find all JSON API responses:**
```bash
node tools/har/har.mjs list trace.har --type json --method POST --has-body
```

**Search for specific data in response bodies:**
```bash
node tools/har/har.mjs search trace.har "pepperoni" --body
```

**Export a response for further analysis:**
```bash
node tools/har/har.mjs body trace.har 15 --pretty --out menu-data.json
```
