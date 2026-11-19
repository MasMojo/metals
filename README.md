# Stack Mojo

A free public dashboard for live precious-metals and crypto spots, ratio and history charts, melt calculators, and a **local-only** stack tracker.

Live site: https://masmojo.github.io/metals/

## What is here

- **Dashboard** — Gold, silver, platinum, palladium, copper, bitcoin, and ether. Live last prices from [Gold API](https://gold-api.com) (no key, CORS, about every 60 seconds with backoff). Bid/ask and day change from [Standard Bullion](https://standardbullion.com) `spot-prices.json`. Crypto 24-hour change from [CoinGecko](https://www.coingecko.com). Gold/silver and BTC/gold ratios, COMEX-style market open/closed, last update in America/Chicago.
- **Charts** — 1W / 1M / 3M / 1Y / 5Y / All, metal selector, gold/silver and BTC/gold ratio charts, and a performance index rebased to 100.
- **Calculators** — Melt calculator and dashboard (US junk 90% / 40% Kennedy / 35% war nickels / Ikes, common 1 oz coins, karat and sterling, foreign gold, Goldbacks as an informational row, proof/mint set notes), premium/discount (buy and sell, shipping, tax, card fee), quick calcs, and a generic spread/value tool. No dealer prices are published.
- **My Stack** — Enter holdings in your browser. Saved in `localStorage`, valued at live spot, with export/import JSON. **Data stays on this device only and is never uploaded.**

The site is a static PWA (manifest + service worker) you can install on a phone.

## What is not here

- No dealer buy/sell prices, no named dealer tables, and no links to anyone’s private spreadsheet.
- No personal holdings in this repository. My Stack is client-side only.
- No API keys or secrets. History is stored as committed JSON.

## Data and attribution

- Live last prices: [Gold API](https://gold-api.com) `/price/{symbol}`.
- Bid/ask, session change, and metals history: [Standard Bullion](https://standardbullion.com). **Data by Standard Bullion** — https://standardbullion.com
- Bitcoin and ether 24h change and last-year history: [CoinGecko](https://www.coingecko.com). Longer Bitcoin history: [Blockchain.com](https://www.blockchain.com) public market-price chart. (CoinGecko’s keyless API now limits history to 365 days.)
- Copper history starts from the daily snapshots in this repo (Standard Bullion’s public history covers gold, silver, platinum, and palladium).

**Indicative prices, not quotes, not financial advice.**

## Daily snapshots

`.github/workflows/history.yml` runs on weekdays (and `workflow_dispatch`) and appends today’s Gold API last prices to `data/history/*.json`. It is idempotent by America/Chicago `run_date`.

To refresh locally:

```bash
python3 scripts/update_history.py --snapshot
# or, first-time public history backfill:
python3 scripts/update_history.py --backfill --snapshot
```

## Serving locally

```bash
python3 -m http.server 8080 --directory .
# open http://127.0.0.1:8080/
```

## License

The site code in this repository is offered as-is for personal and public use. Third-party data remains subject to each provider’s terms; keep the Standard Bullion attribution visible wherever that history or bid/ask feed is shown.
