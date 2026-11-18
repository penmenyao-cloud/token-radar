# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/penmenyao-cloud/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/penmenyao-cloud/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a frozen snapshot of 758 DeFi protocols and ranks every one that records no token and is not an exchange, a bridge, a versioned pool, a named wrapped or staked product, or an exchange's product — 227 protocols, the whole 40-protocol watchlist included — by an implied value computed from five snapshot figures: TVL, seven-day growth, age with no token on record, chain breadth, and standing inside its own category. The dashboard is filterable and sortable, shows a factor-by-factor breakdown for every protocol, and gives each a seven-step farm plan with chain-aware gas bands, time windows, and a concrete exit condition. Protocols whose token already trades are shown apart, with their market cap, never ranked by implied value.

## The model

```
implied = round(1.6 × TVL^0.9
  × (1 + clamp(change_7d, -50, 150) / 100 × 0.6)
  × (0.55 + 0.45 × min(age_days, 1460) / 1460)
  × (1 + 0.04 × min(chains − 1, 5))
  × (1 + 0.2 × min(category share, 0.5)))
```

No protocol name is special-cased. Category share is the protocol's share of its category's TVL across the whole snapshot; a protocol with no category recorded gets no standing bonus. The dashboard recomputes every row from the same formula and checks the number the board carries.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

This writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into `out/`. Running it twice writes the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=85aycs8w&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
