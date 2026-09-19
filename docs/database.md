# Database

Cloudflare D1 (SQLite), Drizzle ORM, SQL migrations committed to `drizzle/`.

The database is a Worker binding named `DB`, declared in `wrangler.jsonc`. The
same binding backs every environment: `vite dev` and `wrangler dev` read a local
SQLite file under `.wrangler/state`, the deployed Worker reads the real D1
database, and the integration tests start a throwaway in-memory one.

## Tables

### Authentication (Better Auth)

| Table          | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `user`         | Identity: id, name, email (unique), email_verified, timestamps   |
| `session`      | Database-backed sessions: token (unique), expiry, IP, user agent |
| `account`      | Credential rows; `password` holds a scrypt hash, never plaintext |
| `verification` | Email verification and reset tokens                              |

Column names follow Better Auth's contract exactly. Renaming anything here breaks
sign-in.

### Domain

| Table                     | Key columns                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `financial_accounts`      | user_id, name, account_type, institution, currency, description, is_active                                                                                                                 |
| `assets`                  | user_id, account_id?, name, asset_type, symbol?, currency, quantity, unit_price, manual_value?, acquisition_cost?, valuation_date, notes                                                   |
| `transactions`            | user_id, account_id, asset_id?, transaction_type, transaction_date, quantity?, unit_price?, gross_amount, fee_amount, tax_amount, currency, exchange_rate?, import_batch_id?               |
| `liabilities`             | user_id, account_id?, name, liability_type, currency, original_principal, outstanding_balance, interest_rate, minimum_payment?, monthly_payment?, start_date?, maturity_date?              |
| `cashflow_entries`        | user_id, entry_type, category, name, amount, currency, frequency, entry_date, end_date?, is_recurring                                                                                      |
| `asset_prices`            | asset_id, price, currency, price_date, source                                                                                                                                              |
| `exchange_rates`          | base_currency, quote_currency, rate, rate_date, source                                                                                                                                     |
| `portfolio_snapshots`     | user_id, snapshot_date, base_currency, total_assets, total_liabilities, net_worth, liquid_assets, investment_assets, metadata_json                                                         |
| `financial_goals`         | user_id, name, goal_type, target_amount, current_amount, currency, target_date?, priority, status                                                                                          |
| `user_financial_settings` | user_id (PK), base_currency, locale, timezone, fiscal_year_start_month, return/inflation assumptions, emergency_fund_months, display_decimals, birth_year?, retirement_age?, onboarded_at? |
| `import_batches`          | user_id, kind, file_name, file_size, content_hash, row_count, imported_count, rejected_count, status                                                                                       |

`exchange_rates` is the one table not scoped by user: rates are reference data and
contain nothing personal.

## Column types

SQLite has five storage classes and no arbitrary-precision numeric, so the
schema maps each kind of value to the class that keeps it exact:

| Kind                                     | Storage               | Why                                                                   |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Money, quantities, prices, rates         | `text`                | An exact decimal string. See below.                                   |
| Calendar dates                           | `text` (`YYYY-MM-DD`) | Sorts and compares correctly as text; the engine already uses strings |
| Instants (created/updated at)            | `integer` (epoch ms)  | Drizzle converts to and from `Date`                                   |
| Booleans                                 | `integer` (0/1)       | Drizzle converts to and from `boolean`                                |
| UUID keys                                | `text`                | Generated on insert with `crypto.randomUUID()`                        |
| JSON (`metadata_json`, `sleeve_targets`) | `text`                | Drizzle serialises and parses                                         |

### Why decimals are `text`

A `REAL` column would round anything past 15–16 significant digits, and
`NUMERIC` affinity would silently convert `'1234567890123456.12345678'` into a
REAL on the way in. `TEXT` affinity stores the bytes it is given. The engine's
`toStorage()` writes canonical decimal strings, Drizzle returns them unchanged,
and the engine parses them straight into `Decimal`; a value never passes through
a JavaScript `number`.

The precision budget is the engine's, enforced by the Zod schemas rather than by
a column definition: money at 8 dp, quantities at 12 dp, exchange rates at 12 dp,
percentages at 8 dp (`3.4` means 3.4% pa).

Two consequences to keep in mind:

- Values round-trip exactly as written. `'100'` stays `'100'`; nothing pads it
  to `'100.00000000'`. Compare decimals with `Decimal`, never with `===`.
- SQL arithmetic over these columns (`sum`, `*`) needs an explicit
  `CAST(... AS REAL)` and is a floating-point result — fine for a rollup or a
  chart, not for anything that must reconcile to the cent. Exact totals come
  from the engine.

## Enumerations

Persisted as `text` with a `CHECK` constraint. These lists grow — new asset
classes, new transaction types — and the values live in one place.

The allowed values live in `src/lib/types/domain.ts` and are used to generate both
the CHECK constraints and the Zod schemas, so they cannot drift apart.

## Delete behaviour

Stated on every foreign key, never inherited:

| From → to                             | Behaviour  | Reason                                                        |
| ------------------------------------- | ---------- | ------------------------------------------------------------- |
| anything → `user`                     | `cascade`  | Deleting an account must be complete                          |
| `assets` → `financial_accounts`       | `set null` | Losing a wrapper must not destroy the holdings inside it      |
| `liabilities` → `financial_accounts`  | `set null` | Same                                                          |
| `transactions` → `financial_accounts` | `restrict` | Trade history must not vanish with its account                |
| `transactions` → `assets`             | `restrict` | Cost basis and realised gains are computed from that history  |
| `asset_prices` → `assets`             | `cascade`  | A price is meaningless without its asset                      |
| `transactions` → `import_batches`     | `set null` | Deleting an import record must not delete the rows it created |

The `restrict` cases surface as a friendly 409 from the service layer, telling the
user what to deal with first.

## Indexes

Every table indexes `user_id`. Beyond that:

- Composite `(user_id, <date>)` on transactions, cash flow, assets and snapshots
- `account_id` and `asset_id` on every table that references them
- `symbol` and `currency` on assets, for lookup and grouping
- Unique `(asset_id, price_date, source)` on prices — one price per asset per day per source
- Unique `(base, quote, rate_date, source)` on exchange rates
- Unique `(user_id, snapshot_date)` on snapshots — re-running an analysis overwrites the day rather than accumulating rows

## Check constraints

Beyond the enum lists:

- Currency columns must match `[A-Z][A-Z][A-Z]` (SQLite `GLOB`; there is no regex operator)
- Quantities, prices, balances, fees and taxes cannot be negative — checked as
  `CAST(col AS REAL) >= 0`, which the cast cannot get wrong for a sign
- Exchange rates must be strictly positive
- `fiscal_year_start_month` between 1 and 12
- `emergency_fund_months` between 1 and 36
- `display_decimals` in (0, 2)
- `target_amount` strictly positive

The database enforces these independently of the application, so a bad row cannot
arrive through any path. Foreign keys are enforced too: D1 runs with
`PRAGMA foreign_keys = ON`.

## Writes and atomicity

D1 has no interactive transactions — `BEGIN` is rejected — so there is no
`db.transaction(async (tx) => …)` in which reads and writes interleave. What it
has is `batch()`, which runs a list of prepared statements as one implicit
transaction: every statement commits or none does.

Two limits shape how writes are built (`src/lib/server/db/batch.ts`):

- **100 bound parameters per statement.** A multi-row `INSERT` spends one per
  column per row, so `insertAll()` splits rows into statements sized from the
  table's width (a 16-column table takes 6 rows per statement).
- **One batch is one transaction.** `insertAll()` sends all of those statements
  as a single batch, so a constraint failure on row 4,000 rolls back rows
  1–3,999 too.

The CSV import is the consumer: it reads everything it needs first (accounts by
name, holdings by symbol, existing signatures for duplicate detection), builds
the complete row set, and writes it with one `insertAll()`. A partially imported
file never survives a failure.

## Migrations

Drizzle writes them; wrangler applies them. Both use the same `drizzle/` folder
(`migrations_dir` in `wrangler.jsonc`), and wrangler records what it has applied
in the database's own `d1_migrations` table.

```bash
pnpm db:generate         # diff the schema, write drizzle/NNNN_<name>.sql
pnpm db:migrate          # apply to the local database (.wrangler/state)
pnpm db:migrate:remote   # apply to the deployed D1 database
pnpm db:seed             # demo household into the local database
pnpm db:reset            # delete the local database; migrate again to rebuild
```

`drizzle-kit generate` needs no connection — it only reads the schema and
`drizzle/meta`. There is no `push` or `studio`: D1 is a binding, not a URL, and
`wrangler d1 execute wealthscope --local --command "select …"` is the browse tool.
