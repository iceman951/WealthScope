# Architecture

## The shape of a request

```
Browser
  │
  ├── hooks.server.ts
  │     1. resolve the session cookie into event.locals.user
  │     2. reject unauthenticated requests to protected prefixes
  │     3. attach security headers; mark personalised responses uncacheable
  │
  ├── Route: +page.server.ts load / actions
  │     parse, authorize, call a service, shape the response
  │
  ├── Service: src/lib/server/services/
  │     business rules, cross-repository orchestration, transaction boundaries
  │
  ├── Repository: src/lib/server/repositories/
  │     user-scoped Drizzle queries, persistence mapping
  │
  └── Cloudflare D1 (SQLite), via the `DB` binding
```

The financial engine sits beside this chain, not in it. Services call it with plain
inputs and get plain results back.

## Layer responsibilities

### Routes

Parse the request, resolve authentication, call one service, return a SvelteKit
response. No SQL, no business rules. Form actions handle CRUD; `+server.ts`
endpoints exist only for file downloads, async client reads and the auth handler.

### Services (`src/lib/server/services/`)

| Module         | Owns                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `portfolio.ts` | The canonical analysis: loads everything, runs the engine, returns metrics |
| `records.ts`   | CRUD for accounts, assets, liabilities, cash flow, transactions, goals     |
| `import.ts`    | CSV preview and the transactional commit                                   |
| `export.ts`    | CSV generation per entity                                                  |
| `snapshots.ts` | Snapshot capture from the server-side analysis                             |
| `result.ts`    | The one `ActionResult` shape every form action returns                     |

Services own the rules that span repositories. Two examples:

- An account with transactions cannot be deleted, because the foreign key is
  `ON DELETE RESTRICT` and losing the wrapper would take the trade history with it.
- A holding with transactions cannot be deleted, because cost basis and realised
  gains are computed from that history.

### Repositories (`src/lib/server/repositories/`)

Every function takes `userId` as its first argument and puts it in the `WHERE`
clause. There is no method that can read or write a row without one. A record
belonging to another user is simply not found — never a 403, which would confirm
the id exists.

Repositories accept an optional `DbClient`, so the same method works inside and
outside a transaction.

### Financial engine (`src/lib/engine/`)

Pure functions over plain inputs. No database import, no Svelte import, no
Cloudflare import — enforced by review and by the fact that every module is
unit-tested with literals.

| Module            | Computes                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| `money.ts`        | Decimal parsing, exact arithmetic, rounding policy, formatting         |
| `currency.ts`     | Rate resolution (direct, inverse, triangulated) and conversion         |
| `net-worth.ts`    | Converted assets less converted liabilities; liquidity classification  |
| `allocation.ts`   | Shares by class, account, currency, instrument; HHI and concentration  |
| `cashflow.ts`     | Monthly run rate, savings rate, category breakdown, trailing 12 months |
| `debt.ts`         | Weighted rates, debt service, amortisation, avalanche payoff order     |
| `returns.ts`      | Cost basis, unrealised and FIFO realised gains, income, sleeve drift   |
| `risk.ts`         | Volatility, drawdown, correlation, Sharpe, exposure, stress scenarios  |
| `projection.ts`   | Deterministic monthly compounding, real values, milestones             |
| `health-score.ts` | Six dimensions mapped from stated anchors, plus the composite          |
| `findings.ts`     | Rule objects: id, severity, predicate, copy template                   |
| `analysis.ts`     | One pass that assembles all of the above                               |

## Data flow through the boundary

`src/hooks.ts` registers a `transport` for `Decimal`, so a load function can
return exact engine results and the browser receives Decimals rather than floats.
Without it every value would need stringifying at each boundary, and one missed
conversion would silently reintroduce binary floating point.

## Rendering

| Route group               | Mode                             | Why                                      |
| ------------------------- | -------------------------------- | ---------------------------------------- |
| `/`, `/privacy`, `/terms` | Prerendered                      | Static; served from the CDN edge         |
| `(auth)`                  | SSR                              | Needs a request context, never cached    |
| `(app)`                   | SSR, then client-side navigation | First paint is server-rendered with data |

SSR is never disabled. `CorrelationHeatmap.svelte` is the only browser-only
component, and it imports ECharts inside `onMount`, so there is nothing to
hydrate and no SSR mismatch.

## Query strategy

The dashboard is the busiest screen. It issues:

1. Five parallel reads (settings, assets, liabilities, cash flow, snapshots)
2. One rates read
3. Two extra reads (recent transactions, cash-flow entries for the bar chart)

Not one query per card. `listAccountsWithUsage` and `shellSummary` use correlated
subqueries so counts arrive with their rows rather than in an N+1 loop.

## Atomic writes

D1 has no interactive transactions, so multi-statement writes are shaped as
read-then-batch: gather what the write depends on, build the full row set, then
send it as one `db.batch()`, which D1 runs as a single implicit transaction.
`insertAll()` in `src/lib/server/db/batch.ts` does the chunking (D1 binds at most
100 parameters per statement) and the batching. It is used where a partial write
would be wrong — currently the CSV import, where a failure must leave the account
exactly as it was. See [`database.md`](database.md#writes-and-atomicity).

The binding itself arrives on `event.platform.env.DB`; `handleDatabase` in
`hooks.server.ts` hands it to `bindDatabase()` before anything else runs, which
is what lets `getDb()` stay synchronous for the repositories' default parameters.

## Component organisation

```
components/
├── base/       Button IconButton StatusTag CurrencyDisplay PercentageDisplay
│               MetricCard SummaryCard
├── forms/      FormField TextInput NumberInput CurrencyInput Select DateInput
│               Checkbox SegmentedControl RecordDialog
├── tables/     DataTable Pagination
├── feedback/   Dialog ConfirmationDialog Toast EmptyState LoadingSkeleton ErrorMessage
├── charts/     ChartFrame TrendChart AllocationBar BarMeter HealthMeter FlowBars
│               CorrelationHeatmap
└── layout/     AppShell Sidebar ScreenHeader LegalPage navigation.ts
```

`ChartFrame` wraps every chart with its four states (ready, loading, empty, error)
and its accessible equivalent — a text summary plus an optional table toggle.

## What is deliberately absent

- No global store mirroring server data. Settings arrive with the layout's page
  data and are read through context via a getter, so there is one source of truth.
- No REST endpoint duplicating a form action. Endpoints exist for downloads,
  async reads and the auth handler only.
- No `any`. Lint fails the build on it.
