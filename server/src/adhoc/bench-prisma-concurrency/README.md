# Prisma + SQLite Concurrency Benchmark

Measures whether the single-caller `usePrismaClient` lock in
`server/src/api/storage/client.ts` is still a perf win on Prisma 6.

## What it does

For each workload scenario (`micro`, `reads`, `mixed`), runs the workload
against a **temp copy** of `server/dining.db` at multiple concurrency levels,
both with and without a per-call `PriorityLock`. Reports throughput, latency
percentiles, and `SQLITE_BUSY` counts.

## Run

From `server/`:

```sh
npx tsc
node --expose-gc dist/adhoc/bench-prisma-concurrency/main.js
```

### Flags (all optional)

| Flag | Default | Meaning |
|---|---|---|
| `--scenario=micro,reads,mixed` or `=all` | `all` | Which workloads to run. |
| `--concurrency=1,2,4,8,16,32` | `1,2,4,8,16,32` | Concurrency levels (unlocked). Locked is always run at 1. |
| `--iterations=N` | `500` | Ops per run. |
| `--repeats=K` | `5` | Runs per cell; results report mean ± stddev. |
| `--warmup=N` | `50` | Warmup ops (discarded) per repeat. |
| `--db=path/to/dining.db` | `server/dining.db` | Source DB to copy. |
| `--out=path` | `server/src/adhoc/bench-prisma-concurrency/results` | Output directory. |
| `--journal-mode=inherit,wal,delete,...` | `inherit` | One or more SQLite `journal_mode` values to sweep. `inherit` keeps whatever is on the source DB. Each mode is applied to the copy via `PRAGMA journal_mode=...` before sampling/warmup, so cells are properly isolated. |
| `--synchronous=inherit\|off\|normal\|full\|extra` | `inherit` | SQLite `synchronous` setting applied per copy. |
| `--keep-db` | off | Don't delete the temp copies (debugging). |

Each repeat starts from a fresh DB copy in `os.tmpdir()`, so write contention
doesn't accumulate across runs.

## Comparing journal modes (e.g. WAL vs DELETE)

```sh
node --expose-gc dist/adhoc/bench-prisma-concurrency/main.js \
  --journal-mode=delete,wal --synchronous=normal \
  --iterations=200 --repeats=3
```

The report includes one table per `(scenario, journal_mode)` and a final
cross-mode summary table showing the best unlocked throughput per scenario
for each mode side-by-side.

## Output

`results/<timestamp>/results.md` and `results/<timestamp>/results.csv`. The
markdown includes per-scenario tables and a "headline" line of the form:

> parallel-unlocked@8 is **FASTER** at 1.74× the throughput of serial-locked baseline.

## Scenarios

- **micro** — single-table `findUnique`, `findMany take:50`, `$queryRaw SELECT 1`. Cleanest signal.
- **reads** — representative storage-client reads (menu item detail with modifiers, daily-station joins, top searches, recent reviews, review aggregates).
- **mixed** — ~60/40 read/write. Adds `SearchQuery` upserts (mostly hot keys), anonymous `Review` creates, and hot-row `MenuItem` `externalLastUpdateTime` updates. This is the scenario the original lock was guarding against.

## Notes

- Each cell uses its own fresh `PrismaClient` bound to the copied DB via `datasourceUrl` — never touches the production DB or shares state with the prod client.
- "Locked" cells use a **local** `PriorityLock` instance (the global one in `client.ts` is left alone).
- Run with `--expose-gc` so GC can be triggered between repeats, reducing variance.
- If you see lots of `SQLITE_BUSY` errors in the unlocked + writes case, that's a real cost of removing the lock and is reflected in the report.

## Interpreting results

Compare `parallel-unlocked@N` rows to the `serial-locked` (locked, c=1) baseline:

- **≥ 1.05× throughput, no error spike** → lock is now a tax; consider removing or relaxing.
- **≈ 1.0× (within ±5%)** → lock is roughly free; safe to keep for now.
- **≤ 0.95× or noticeable `SQLITE_BUSY` count** → lock is still helping; keep it.

Re-run with different `--concurrency` values to find inflection points.
