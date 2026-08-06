# Database

Neon Serverless PostgreSQL, Drizzle ORM, SQL migrations committed to `drizzle/`.

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

## Numeric types

| Kind                           | Type              | Why                                         |
| ------------------------------ | ----------------- | ------------------------------------------- |
| Money and balances             | `numeric(24, 8)`  | ~10^16 major units at 8 dp                  |
| Asset quantities               | `numeric(30, 12)` | Fractional shares and 12-dp crypto units    |
| Asset prices                   | `numeric(24, 8)`  |                                             |
| Exchange rates                 | `numeric(24, 12)` | Weak-currency pairs need the extra places   |
| Interest rates and percentages | `numeric(14, 8)`  | Stored as a percentage: `3.4` means 3.4% pa |

Drizzle returns `numeric` as a string. The engine parses those strings straight
into `Decimal`; a value never passes through a JavaScript `number`.

## Enumerations

Persisted as `text` with a `CHECK` constraint, not as a PostgreSQL enum type.
These lists grow — new asset classes, new transaction types — and altering a
CHECK is a one-line migration where altering an enum is not.

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

- Currency columns must match `^[A-Z]{3}$`
- Quantities, prices, balances, fees and taxes cannot be negative
- Exchange rates must be strictly positive
- `fiscal_year_start_month` between 1 and 12
- `emergency_fund_months` between 1 and 36
- `display_decimals` in (0, 2)
- `target_amount` strictly positive

The database enforces these independently of the application, so a bad row cannot
arrive through any path.

## Commands

```bash
pnpm db:generate     # regenerate SQL from the schema
pnpm db:migrate      # apply pending migrations
pnpm db:studio       # browse
pnpm db:push         # local iteration only — never the production path
pnpm db:seed         # development seed
```
