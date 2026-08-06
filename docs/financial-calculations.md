# Financial calculations

Every formula the application uses is written down here. Nothing on any screen is
a proprietary score.

## Precision

Decimal.js is configured once, in `src/lib/engine/money.ts`:

```ts
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
```

- **Intermediate arithmetic** keeps 40 significant digits and is never rounded.
- **Persistence** rounds to the column scale with half-even, which does not drift
  upward across many operations.
- **Display** rounds with half-up at the moment of formatting, and nowhere else.

`dec()` collapses null, undefined, empty string and non-finite input to zero, so
one missing optional column cannot poison a portfolio total. `tryDec()` is the
strict variant used by validation, which reports unparseable input instead.

`divide()` returns `null` on a zero denominator rather than `Infinity`. Callers
must then decide what "no denominator" means on their screen — which is always an
insufficient-data state, never 0%.

## Currency conversion

`resolveRate(from, to, rates)` tries, in order:

1. The same currency → 1
2. A direct pair
3. The inverse of a recorded pair
4. Triangulation through a pivot currency present in the table

If none resolves, the row is excluded from the total and the pair is collected in
`missingRates`. Screens then show an "incomplete" notice naming the pair. A total
that quietly omits a holding would be worse than no total.

Rates are stored at `numeric(24, 12)`. Snapshots record the rates they applied in
`metadata_json`, so history stays reproducible after rates move.

## Net worth

```
net worth = Σ converted asset values − Σ converted liability balances
```

An asset's value is `manual_value` when set, otherwise `quantity × unit_price`.
Manual valuation wins because a house or a business stake has no per-unit price.

**Liquidity** is derived from the asset type _and_ the account it sits in, because
liquidity is a property of where value sits, not of the instrument alone: the same
fund is liquid in a brokerage account and illiquid inside a locked retirement
wrapper.

| Band        | Contents                                            |
| ----------- | --------------------------------------------------- |
| Liquid      | Cash, deposits at call, marketable securities       |
| Semi-liquid | Term deposits, bonds, cooperative shares, T-bills   |
| Illiquid    | Property, vehicles, business stakes, locked savings |

## Allocation and concentration

Shares are computed against the converted asset total, so a portfolio spread
across currencies still sums to 100%. When the total is zero, every share is
`null` — an empty portfolio has no allocation, not a zero one.

**Herfindahl–Hirschman index**, on weights expressed as fractions:

```
HHI = Σ wᵢ²                    0 → perfectly diversified, 1 → one holding
effective holdings = 1 / HHI   how many equally sized holdings it behaves like
```

Bands used in the copy: below 0.15 diversified, 0.15–0.25 moderate, above 0.25
concentrated.

Concentration is measured twice: across the whole balance sheet (where a home
usually dominates) and inside the investment portfolio. They answer different
questions and are shown separately.

## Cash flow

A recurring entry contributes `amount × occurrencesPerYear ÷ 12`:

| Frequency  | Per year |
| ---------- | -------- |
| Weekly     | 52       |
| Biweekly   | 26       |
| Monthly    | 12       |
| Quarterly  | 4        |
| Semiannual | 2        |
| Annual     | 1        |
| One-off    | 0        |

One-off entries contribute nothing to the monthly run rate and are reported
separately. Treating a single purchase as a monthly commitment would understate
the savings rate for a year.

```
net cash flow = monthly income − monthly expenses
savings rate  = net cash flow ÷ monthly income        null when income is zero
emergency cover = liquid assets ÷ monthly expenses    null when expenses are zero
```

## Debt

Rates are stored as annual percentages. Monthly interest uses a simple nominal
rate ÷ 12, applied to the reducing balance — the convention consumer loan
statements in the region use.

```
weighted average rate = Σ(balanceᵢ × rateᵢ) ÷ Σ balanceᵢ
debt-to-assets        = total debt ÷ total assets
debt service ratio    = monthly debt payments ÷ gross monthly income
```

**Amortisation** (`amortise`) iterates month by month:

```
interest  = balance × (annualRate ÷ 100 ÷ 12)
principal = min(payment, balance + interest) − interest
balance   = balance − principal
```

A payment that does not cover one month's interest sets `neverAmortises` and
returns a null payoff month rather than looping to the 60-year cap.

**Avalanche payoff** orders debts by rate, highest first, and rolls each cleared
payment into the next.

## Investment returns

**Unrealised** needs only a cost basis:

```
gain    = market value − cost basis
return% = gain ÷ cost basis          null when there is no basis
```

Holdings without a recorded cost basis are excluded from the aggregate basis and
the portfolio is flagged `costBasisIncomplete`, rather than treating missing cost
as zero.

**Realised** uses FIFO lot matching over the trade history:

- A buy creates a lot at `(grossAmount + fees + tax) ÷ quantity` — acquisition
  costs belong in the basis.
- A sell consumes lots oldest-first; the gain is `netProceeds − matchedCost`,
  where net proceeds are `grossAmount − fees − tax`.
- A sale with no matching purchase increments `unmatchedSales` and is excluded,
  rather than being given an invented basis.

**Total return** = unrealised + realised + net income (dividends + interest −
fees − taxes).

**Annualised return** is computed only when the maths is actually valid: a
positive start value, a positive end value, and at least 30 days of holding
period. Otherwise it returns `null`. No screen currently quotes a portfolio CAGR,
because doing it correctly needs a full dated cash-flow history per holding.

**Sleeve drift** compares actual weight to the target. Beyond ±5 percentage points
a rebalance finding fires.

## Risk

Every function reports how much history it had.

| Metric      | Minimum observations | Below that |
| ----------- | -------------------- | ---------- |
| Volatility  | 24 monthly returns   | `null`     |
| Correlation | 12 overlapping       | `null`     |
| Drawdown    | 2 prices             | `null`     |

```
volatility = sampleStdDev(periodReturns) × √12 × 100     annualised, percent
maxDrawdown = min over t of (priceₜ − peak) ÷ peak       negative percent
correlation = cov(a, b) ÷ (σa × σb)                      Pearson, on returns
```

Below the threshold the engine returns `null` and the screen shows an
insufficient-data state. It never substitutes a class-level assumption and
presents it as a measurement.

**Sharpe ratio** requires an explicit risk-free rate. There is no sane default, so
without one the function returns `null`.

**Stress tests** are static shock vectors shipped with the application, applied to
current weights. No historical market data is stored or redistributed, and the
screens describe them as illustrations rather than predictions.

## Projection

Deterministic monthly compounding:

```
balanceₘ = balanceₘ₋₁ × (1 + annualReturn ÷ 100 ÷ 12) + contribution
realₘ    = balanceₘ ÷ (1 + inflation ÷ 100)^(m ÷ 12)
```

The contribution steps up on each anniversary when contribution growth is set, not
every month. The horizon is clamped to 1–50 years.

The same pure function runs on the server and behind the sliders in the browser,
so the preview and any persisted figure cannot disagree.

Every surface that shows a projection carries the disclaimer: this is arithmetic
on stated assumptions, not a forecast, not advice, and not a guarantee.

## Health score

Six dimensions, each mapped linearly from a "bad" anchor to a "good" anchor and
clamped to 4–100:

| Dimension            | Good                  | Bad  |
| -------------------- | --------------------- | ---- |
| Net worth trajectory | +15%                  | −10% |
| Liquidity cover      | 1.5 × your own target | 0    |
| Debt load            | 10% of assets         | 60%  |
| Savings rate         | 30%                   | 0    |
| Diversification      | HHI 0.10              | 0.40 |
| Concentration risk   | Top holding 15%       | 60%  |

```
score = clamp((value − bad) ÷ (good − bad) × 100, 4, 100)
```

Bands: 80+ Strong, 60+ Adequate, 40+ Watch, below Weak.

A dimension with no data scores `null` and is **left out of the composite**, not
scored zero — an empty portfolio is not an unhealthy one. The skipped dimensions
are named on the screen.

## Findings

Rule objects in `engine/findings.ts`, each with an id, a severity, a predicate
over the computed metrics and a copy template. Adding a rule needs no UI change.

| Rule                          | Severity | Fires when                              |
| ----------------------------- | -------- | --------------------------------------- |
| `expensive-debt`              | Act now  | Highest-rate debt ≥ 12% with a balance  |
| `liquidity-thin`              | Act now  | Cover below 3 months                    |
| `negative-cashflow`           | Act now  | Expenses exceed income                  |
| `single-name-exposure`        | Review   | Top holding above 25% of the portfolio  |
| `balance-sheet-concentration` | Review   | Largest asset above 50% of total assets |
| `sleeve-drift`                | Review   | Any sleeve more than 5pp from target    |
| `debt-service`                | Review   | Debt service above 36% of gross income  |
| `missing-rates`               | Review   | Any unresolved currency pair            |
| `healthy-liquidity`           | Healthy  | Cover at or above your target           |
| `healthy-savings`             | Healthy  | Savings rate 15% or better              |
| `healthy-diversification`     | Healthy  | Portfolio HHI at or below 0.15          |

Every threshold quoted in the copy is the threshold in the rule. None of it is
financial advice.
