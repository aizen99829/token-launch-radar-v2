# token-launch-radar-v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/aizen99829/token-launch-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/aizen99829/token-launch-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over the sealed DefiLlama snapshot of 14 November 2026: 758 protocols
scanned, ranked into a 210-row board — 185 protocols that record no token yet, priced by the
model below, plus the 25 largest already-launched protocols carried as anchors at their real
market cap. Every one of the snapshot's 40 watchlist protocols is on the board, and 170 rows
come from outside the watchlist: the early finds below the $50M floor are the point of a radar.

## The value model

For each pre-token protocol, **implied value = TVL × size-adjusted category multiple × momentum × maturity**. Launched protocols remain anchors at their real market cap.

The multiple uses launched peers. Ratios are winsorised to the global 5–95 percentile band, then each peer is corrected to the target size with the global log-log slope (about −0.48 here: big protocols trade at smaller multiples). The category median of corrected ratios is shrunk toward the global median with weight `n/(n+6)`, then clamped to 0.03×–3×. Every row carries the middle-half band of corrected peer outcomes as its honest value range and a confidence tier A/B/C from peer count and data completeness.

- **Momentum** — `1 + 0,6 × clamp(change_7d, −25, +25) / 100`: seven-day TVL growth is
  rewarded, shrinkage discounted, inside a 0,85×–1,15× band. Unreported growth is neutral.
- **Maturity** — `1 + 0,12 × ln(1 + years)`, capped at 1,5×, where years is the time since
  DefiLlama began tracking the protocol: a product that has held TVL for years with no token
  is a stronger launch candidate than one listed last month. No listing date, no credit.

All blending is in log space, including the band's 25th and 75th percentiles. Values are
rounded to whole dollars and the point estimate is kept inside the band. With no category
peers, global statistics apply. Confidence scores give two points for at least eight peers,
one for four to seven, and one each for a listing date and reported seven-day change:
A needs at least three points, B two, otherwise C; zero launched category peers always caps the tier at C. Launched anchors have confidence A
and a band equal to their real market cap. An implied value is not a prediction that a
token will be issued.

## Validation

The program re-grades itself on every run with leave-one-out over the 128 launched protocols whose real market cap is known, against the naive category-median baseline (the v1 rule). On this sealed snapshot: the model's median error is ×3.6, with 31.3% within 2× and 44.5% within 3×; the baseline is ×5.2, 20.3% and 30.5%. Its middle-half band contained the real market cap in 43.8% of cases (median band width ×9.08), with each band predicted from the other launched peers. An interquartile band is expected to contain roughly half of outcomes; the measured 43.8% coverage shows that this band undercovers real market caps on the sealed snapshot.

## The top of the board

The model's first ten contacts on this snapshot (values are implied unless marked real):

| # | Protocol | Category | TVL | Implied value |
|---|----------|----------|-----|---------------|
| 1 | Binance CEX | CEX | $116.08B | $3.95B |
| 2 | Rain | Prediction Market | $6.6M | $2.65B (real mcap, launched anchor) |
| 3 | OKX | CEX | $26.32B | $1.97B (real mcap, launched anchor) |
| 4 | Aave V2 | Lending | $90.9M | $1.72B (real mcap, launched anchor) |
| 5 | Mantle Bridge | Canonical Bridge | $91.6M | $1.33B (real mcap, launched anchor) |
| 6 | Bitway Earn | Basis Trading | $33.4M | $1.21B (real mcap, launched anchor) |
| 7 | Gate | CEX | $5.46B | $919.7M (real mcap, launched anchor) |
| 8 | Polygon Bridge | Canonical Bridge | $2.56B | $901.7M (real mcap, launched anchor) |
| 9 | Nexo | CEX | $10.2M | $705.9M (real mcap, launched anchor) |
| 10 | LayerZero V2 | Bridge | $17.67B | $529.9M |

## Farm plans

Every row carries a concrete farm plan (4–9 steps) generated from the protocol's category,
chains and size: the actual actions (supply and loop on a lending market, bridge and hold,
provide liquidity, stake and restake, trade to volume tiers), what they cost in gas and
capital at that protocol's chain prices and TVL band, and how long they take — minutes a
day, over how many weeks. Growing protocols get a front-load step; shrinking ones get a
size-down warning. Every pre-token plan ends with its TVL standing among all snapshot pre-token protocols in its category,
peer count, confidence and value band,
with sizing guided by the low end.

## The dashboard

A static page (`dashboard/index.html`, `radar.css`, `radar.js`) in a dark radar-scope
aesthetic: the ranked board as a sortable, filterable table (search, status, chain,
category, TVL band), and a detail view per protocol showing its stats, the model's full
working — each factor, and where the multiple came from — and its farm plan. It renders
with no network; `main.ts` writes its data as `data.js` beside the page.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Node 22, standard library only. In the grader the snapshot is read from
`/input/snapshot.json` and the output written to `/output`: `board.json` (the ranked
board), `data.js` (the dashboard's data), `dashboard/`, `screenshots/` and `dossier.json`,
built with the vendored `vendor/makefun-board.ts`. Run it twice and the bytes are identical.

---
<sub>Entered on [make.fun](https://make.fun/?ref=2a9s4gx3&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
