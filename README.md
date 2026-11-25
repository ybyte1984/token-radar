# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ybyte1984/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ybyte1984/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — a dashboard ranking pre-token protocols by implied launch value, from a sealed DefiLlama snapshot (2026-11-14, 758 protocols). Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

The model (radar-2, in `lib/model.ts`) scores only protocols that record no token, from the snapshot's own figures: TVL x 0.30, a clamped seven-day growth multiplier, a maturity multiplier for how long the protocol has run with no token, a category risk multiplier, and a multi-chain reach multiplier. No protocol name is special-cased. The board covers all 40 watchlist protocols plus every other rankable pre-token protocol in the snapshot (198 rows), and shows live-token protocols separately with their market caps. Every row carries a seven-step farm plan with costs and times.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Then serve the output directory (for example `npx serve out` or `python3 -m http.server -d out`) and open `dashboard/index.html` in a browser. No network, no build step — the dashboard is static files under `dashboard/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=01tqzsjd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
