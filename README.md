# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/penmenyao-cloud/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/penmenyao-cloud/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a frozen snapshot of 758 DeFi protocols and ranks every one that records no token and is not an exchange, a bridge, a versioned pool, a named wrapped or staked product, or an exchange's product — 227 protocols, the whole 40-protocol watchlist included — by an implied value calibrated on the market itself. The dashboard is filterable and sortable, shows a factor-by-factor breakdown for every protocol including its calibration source, and gives each a seven-step farm plan with chain-aware gas bands, time windows, and a concrete exit condition. Protocols whose token already trades are shown apart, with their market cap, never ranked by implied value — but their market caps are what calibrate every row.

## The model

The anchor is the median market-cap-to-TVL ratio of the snapshot's live-token protocols (market cap above zero, locked value above zero), taken per category where the category has at least 5 of them, otherwise the global median. On this snapshot: 128 live-token protocols, global median 0.2138x TVL (first quartile 0.0441, third quartile 1.0435). The median is used because the ratios spread wide; a mean would let one outlier set the anchor for every row.

```
implied = round(TVL × anchor
  × (1 + clamp(change_7d, -50, 150) / 100 × 0.6)
  × (0.55 + 0.45 × min(age_days, 1460) / 1460))
```

No protocol name is special-cased, and no number in the anchor is hand-written: the program computes the medians from the snapshot at runtime, so the same program on a different snapshot prices its rows off that snapshot's own market. Chain breadth is not a separate factor: the market ratios the anchor is built from already price how far a protocol reaches, so a second chain factor would pay for the same reach twice. The dashboard recomputes every row from the same formula and checks the number the board carries.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

This writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into `out/`. Running it twice writes the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=85aycs8w&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
