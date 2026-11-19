# Stack Mojo

A free public dashboard for live precious-metals and crypto spots, ratio and history charts, melt calculators, and a **local-only** stack tracker.

Live site: https://masmojo.github.io/metals/

## What is here

- **Dashboard** — Gold, silver, platinum, palladium, copper, bitcoin, and ether. Live last prices from [Gold API](https://gold-api.com) (no key, CORS, about every 60 seconds with backoff). Bid/ask and day change from [Standard Bullion](https://standardbullion.com) `spot-prices.json`. Crypto 24-hour change from [CoinGecko](https://www.coingecko.com). Gold/silver and BTC/gold ratios, COMEX-style market open/closed, last update in America/Chicago.
- **Charts** — 1W / 1M / 3M / 1Y / 5Y / All, metal selector, gold/silver and BTC/gold ratio charts, and a performance index rebased to 100 with a CPI-U overlay and an optional real (inflation-adjusted) view.
- **Fair Deal** — A peer-to-peer worksheet: you type a dealer ask and buy-back, pick a split of the spread, and see a suggested fair price, each side’s “win,” totals, and shipping/platform-fee nets, plus a safety checklist and generic links to public trading venues. No dealer prices are published. Last inputs can stay in `localStorage` on this device only.
- **Calculators** — Melt calculator and dashboard (US junk 90% / 40% Kennedy / 35% war nickels / Ikes, common 1 oz coins, karat and sterling, foreign gold, Goldbacks as an informational row), a year-by-year US proof / Silver Proof / SMS / mint-set silver table (ASW and live melt, with sources), premium/discount (buy and sell, shipping, tax, card fee), quick calcs, and a generic spread/value tool. No dealer prices are published.
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
- Copper: longer history from [FRED](https://fred.stlouisfed.org/series/PCOPPUSDM) `PCOPPUSDM` (IMF global price, USD per metric ton, monthly, converted to USD per pound). Daily last prices and day change come from Gold API snapshots in this repo — the monthly average is a different series and is not used as a daily close. Standard Bullion’s public history covers gold, silver, platinum, and palladium only.
- CPI-U overlay and real returns: [FRED](https://fred.stlouisfed.org/series/CPIAUCSL) `CPIAUCSL` (CPI-U All Items, seasonally adjusted, monthly). The series lags; the latest observation is usually the previous month, published around mid-month. Fetched in GitHub Actions as a public CSV with no API key.

**Indicative prices, not quotes, not financial advice.**

## Daily snapshots

`.github/workflows/history.yml` runs on weekdays (and `workflow_dispatch`) and appends today’s Gold API last prices to `data/history/*.json`, and refreshes `data/history/cpi.json` plus monthly copper in `data/history/hg.json` from FRED (no key). It is idempotent by America/Chicago `run_date`.

To refresh locally:

```bash
python3 scripts/update_history.py --snapshot
# FRED CPI and monthly copper only:
python3 scripts/update_history.py --fred
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
