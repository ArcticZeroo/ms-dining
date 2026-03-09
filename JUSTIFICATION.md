# Design Justification — feature/thumbnail-dedup

## 1. dHash perceptual hashing vs MD5/SHA content hashing

**Chosen:** Use difference hash (dHash) — a perceptual hashing algorithm that computes a 64-bit fingerprint by comparing adjacent pixel intensities in a downscaled grayscale image.

**Why it's right:** Many menu item thumbnails are visually identical but differ at the byte level due to compression artifacts, re-encoding, or minor metadata differences. A content hash (MD5/SHA) treats these as distinct files. dHash catches perceptual duplicates — images that look the same to a human — which is the deduplication that actually matters for saving cache entries and disk space. It's also fast: the algorithm is a simple series of pixel comparisons on a 9×8 downscaled image, with no cryptographic overhead.

**Alternatives rejected:**

- **MD5/SHA content hash:** Exact-match only. Two JPEG-to-PNG conversions of the same source image produce different content hashes. Misses the most common class of duplicates (visually identical, byte-different).
- **Average hash (aHash):** Less discriminating than dHash — more false positives. dHash captures gradient information (relative brightness changes), making it better at distinguishing similar-but-different images.

## 2. Hash-based filenames (`static/thumbnails/{hash}.png`) vs server-side redirect

**Chosen:** Save each thumbnail to `static/thumbnails/{hash}.png` where `{hash}` is the dHash hex string. Client constructs URLs using the hash directly.

**Why it's right:** The primary win is **browser cache deduplication**. When two menu items share the same thumbnail, they resolve to the same URL (`/static/thumbnails/abc123.png`). The browser fetches it once and serves it from cache for both items. With the old approach (per-item URLs + server redirect), the browser sees two different URLs, caches them separately, and makes two requests (even if the server redirects to a canonical ID, the browser still caches by the original URL, not the redirect target).

**Alternatives rejected:**

- **Server-side 302 redirect from per-item URL to canonical URL:** The diff actually *removes* this approach (the deleted `router.get('/menu-items/thumbnail/:filename')` redirect handler). Redirects don't help browser caching — the browser caches by request URL, so each menu item's URL is a separate cache entry regardless of where it redirects. The redirect also adds a round-trip per uncached request.
- **Server-side content-addressed storage with `Content-Location` header:** Complex to implement, inconsistent browser support for deduplication via `Content-Location`.

## 3. Manifest file for boot vs scanning disk

**Chosen:** On boot, read a manifest JSON file that maps item IDs to their thumbnail metadata (hash, dimensions). Cross-reference against the actual files on disk with a `readdir` call.

**Why it's right:** Scanning thousands of thumbnail files with an image-processing library (to recompute hashes) is slow — it requires reading each file, decoding the image, and running the hash algorithm. The manifest is a single JSON read that provides all metadata instantly. Cross-referencing against `readdir` catches stale entries (files deleted externally) without the cost of opening each file.

**Alternatives rejected:**

- **Scan disk and recompute hashes on every boot:** Too slow. Thousands of files × image decode + hash computation = seconds-to-minutes of startup delay.
- **Trust the manifest blindly without disk verification:** Files can be deleted externally (manual cleanup, disk errors). A stale manifest would report thumbnails that don't exist, causing 404s. The `readdir` check is cheap (single syscall) and catches this.
- **Lazy-load on first request:** Would block the first user's request on reading and processing all thumbnails. Unacceptable latency for a real-time web app.

## 4. Debounced (10s) + max-interval (30s) manifest save

**Chosen:** Manifest writes are debounced with a 10-second delay and a 30-second maximum interval, plus a flush on shutdown.

**Why it's right:** At boot, the backfill migration processes hundreds of thumbnails in rapid succession. Each processed thumbnail updates the in-memory manifest. Without debouncing, this would trigger hundreds of disk writes in seconds — wasteful I/O that slows down boot. The debounce waits for a 10-second quiet period before writing; the 30-second max-interval ensures the manifest is persisted even during sustained bursts; the shutdown flush ensures no data is lost on graceful exit.

**Alternatives rejected:**

- **Immediate save on every change:** Hundreds of concurrent writes during boot. Thrashes the disk, risks write contention and partial writes.
- **Periodic-only save (e.g. every 60 seconds):** Up to 60 seconds of data loss on crash. No flush during idle periods means data sits in memory unnecessarily long.
- **Save only on shutdown:** All data lost on crash or `kill -9`. Unacceptable for a manifest that takes minutes to rebuild.

## 5. `thumbnailId` in API response vs server-constructed URLs

**Chosen:** Added an optional `thumbnailId` field (the dHash hex string, 16 characters) to `IMenuItemBase` and `IMenuItemDTO`. The client's `getThumbnailUrlForMenuItem()` checks for `thumbnailId` first and constructs `/static/thumbnails/{thumbnailId}.png`, falling back to the old per-item path.

**Why it's right:** The client already has a `getThumbnailUrlForMenuItem()` function that constructs thumbnail URLs. Adding the hash as a field lets the client build the deduped URL itself, which is consistent with the existing pattern. The field is optional, so older clients and items without hashes continue to work via the fallback path. At 16 characters, the payload overhead is negligible.

**Alternatives rejected:**

- **Server returns fully constructed thumbnail URLs:** Would increase payload size more (full URL vs 16-char hash) and couple the client to the server's URL scheme. The client already owns URL construction.
- **Server-side redirect (removed in this PR):** As discussed above, redirects don't achieve browser cache deduplication.

## 6. Always overwrite hash file vs skip-if-exists

**Chosen:** When creating a new thumbnail, always write to `static/thumbnails/{hash}.png`, overwriting any existing file at that path.

**Why it's right:** If two different images produce the same dHash (astronomically unlikely with 64 bits, but nonzero), skip-if-exists would permanently serve the wrong image for one of them. Overwriting is harmless when the content is identical (which it is in 99.999...% of cases) and self-correcting in the vanishingly rare collision case. The write cost is trivial compared to the image processing that precedes it.

**Alternatives rejected:**

- **Skip if file exists (`COPYFILE_EXCL`):** Used in the backfill migration (where speed matters and we're processing historical data), but not for live thumbnail creation. In the migration context, skipping is acceptable because the first writer wins and subsequent duplicates are identical. For live creation, always overwriting ensures the freshest image is served.

## 7. Backfill migration uses `COPYFILE_EXCL` (skip-if-exists)

**Chosen:** The backfill migration (`backfill-thumbnail-hashes.ts`) copies existing thumbnails to hash-based paths using `fs.constants.COPYFILE_EXCL`, silently skipping files that already exist.

**Why it's right:** During backfill, hundreds of per-item thumbnails map to the same hash. The first copy establishes the hash file; subsequent copies of identical content are redundant. `COPYFILE_EXCL` avoids unnecessary I/O. The `try/catch` silences the expected `EEXIST` error. This is safe because all source images that hash to the same value are perceptually identical — it doesn't matter which one "wins."
