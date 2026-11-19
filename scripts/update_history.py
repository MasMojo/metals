#!/usr/bin/env python3
"""Fetch live spots and merge historical series into data/history/.

No API keys. Public sources only:
  - Gold API live /price (XAU, XAG, XPT, XPD, HG, BTC, ETH)
  - Standard Bullion history + spot-prices.json (XAU, XAG, XPT, XPD)
    Attribution: Data by Standard Bullion — https://standardbullion.com
  - CoinGecko market_chart for BTC and ETH

Idempotent: a Chicago-calendar run_date is upserted, not duplicated.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HIST = DATA / "history"
UA = "StackMojo/1.0 (https://masmojo.github.io/metals/; history snapshot)"
TZ = ZoneInfo("America/Chicago")
GOLD_API = "https://api.gold-api.com/price/{sym}"
SB_SPOT = "https://standardbullion.com/spot-prices.json"
SB_HIST = "https://standardbullion.com/api/v1/market/history?metal={metal}&range={rng}"
CG_CHART = "https://api.coingecko.com/api/v3/coins/{coin}/market_chart?vs_currency=usd&days=365"
CG_PRICE = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
# CoinGecko's public API only allows 365 days of history without a key (error 10012).
# Longer BTC series comes from Blockchain.com's public market-price chart (no key).
BC_BTC = "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false"

ASSETS = [
    {"id": "xau", "symbol": "XAU", "name": "Gold", "unit": "USD per troy ounce", "gold_api": "XAU", "sb": True},
    {"id": "xag", "symbol": "XAG", "name": "Silver", "unit": "USD per troy ounce", "gold_api": "XAG", "sb": True},
    {"id": "xpt", "symbol": "XPT", "name": "Platinum", "unit": "USD per troy ounce", "gold_api": "XPT", "sb": True},
    {"id": "xpd", "symbol": "XPD", "name": "Palladium", "unit": "USD per troy ounce", "gold_api": "XPD", "sb": True},
    {"id": "hg", "symbol": "HG", "name": "Copper", "unit": "USD per pound", "gold_api": "HG", "sb": False},
    {"id": "btc", "symbol": "BTC", "name": "Bitcoin", "unit": "USD per bitcoin", "gold_api": "BTC", "sb": False, "coingecko": "bitcoin"},
    {"id": "eth", "symbol": "ETH", "name": "Ethereum", "unit": "USD per ether", "gold_api": "ETH", "sb": False, "coingecko": "ethereum"},
]

SB_RANGES = ("max", "5y", "1y", "3m", "1m")
SB_ATTR = "Data by Standard Bullion — https://standardbullion.com"


def chicago_now() -> datetime:
    return datetime.now(TZ)


def get_json(url: str, timeout: int = 60):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.status


def polite_get(url: str, pause: float = 1.2):
    try:
        data, status = get_json(url)
        time.sleep(pause)
        return data
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} for {url}", file=sys.stderr)
        time.sleep(pause)
        return None
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        time.sleep(pause)
        return None


def load_series(asset_id: str) -> dict:
    path = HIST / f"{asset_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {}


def save_series(doc: dict) -> None:
    HIST.mkdir(parents=True, exist_ok=True)
    path = HIST / f"{doc['id']}.json"
    path.write_text(json.dumps(doc, indent=2, sort_keys=False) + "\n")


def merge_points(existing: list, incoming: list) -> list:
    by_t = {}
    for p in existing or []:
        if p.get("t") is not None and p.get("price") is not None:
            by_t[str(p["t"])[:19]] = {"t": p["t"], "price": float(p["price"])}
    for p in incoming or []:
        if p.get("t") is None or p.get("price") is None:
            continue
        t = p["t"]
        if isinstance(t, (int, float)):
            # CoinGecko ms
            t = datetime.utcfromtimestamp(t / 1000.0).strftime("%Y-%m-%dT00:00:00Z")
        t = str(t)
        if t.endswith("Z") is False and "T" not in t:
            t = t + "T00:00:00Z"
        key = t[:19]
        by_t[key] = {"t": t if t.endswith("Z") or "+" in t else t + "Z", "price": float(p["price"])}
    points = sorted(by_t.values(), key=lambda p: p["t"])
    return points


def backfill_standard_bullion(asset: dict, doc: dict) -> dict:
    if not asset.get("sb"):
        return doc
    all_pts = list(doc.get("points") or [])
    for rng in SB_RANGES:
        url = SB_HIST.format(metal=asset["symbol"], rng=rng)
        data = polite_get(url, pause=1.5)
        if not data or not data.get("points"):
            continue
        all_pts = merge_points(all_pts, data["points"])
        print(f"  SB {asset['symbol']} range={rng}: {len(data['points'])} pts (merged {len(all_pts)})")
    doc["points"] = all_pts
    doc["source"] = "Standard Bullion"
    doc["attribution"] = data.get("attribution") if data else SB_ATTR
    doc["source_url"] = "https://standardbullion.com"
    return doc


def backfill_coingecko(asset: dict, doc: dict) -> dict:
    coin = asset.get("coingecko")
    if not coin:
        return doc
    data = polite_get(CG_CHART.format(coin=coin), pause=2.5)
    if not data or not data.get("prices"):
        print(f"  CoinGecko {coin}: no data")
    else:
        incoming = [{"t": row[0], "price": row[1]} for row in data["prices"] if len(row) >= 2]
        doc["points"] = merge_points(doc.get("points") or [], incoming)
        sources = set(s for s in (doc.get("source") or "").split(" + ") if s)
        sources.add("CoinGecko")
        doc["source"] = " + ".join(sorted(sources))
        doc["source_url"] = "https://www.coingecko.com"
        doc["attribution"] = (doc.get("attribution") or "")
        extra = "Recent history: CoinGecko (public API, last 365 days)."
        if extra not in (doc.get("attribution") or ""):
            doc["attribution"] = " ".join(x for x in [doc.get("attribution"), extra] if x)
        print(f"  CoinGecko {coin}: {len(incoming)} pts (merged {len(doc['points'])})")
    return doc


def backfill_blockchain_btc(doc: dict) -> dict:
    data = polite_get(BC_BTC, pause=1.5)
    vals = (data or {}).get("values") or []
    if not vals:
        print("  Blockchain.com BTC chart: no data")
        return doc
    incoming = []
    for row in vals:
        if row.get("y") in (None, 0, 0.0):
            continue
        incoming.append({"t": int(row["x"]) * 1000, "price": row["y"]})
    doc["points"] = merge_points(doc.get("points") or [], incoming)
    sources = set(s for s in (doc.get("source") or "").split(" + ") if s)
    sources.add("Blockchain.com")
    doc["source"] = " + ".join(sorted(sources))
    extra = "Longer Bitcoin history: Blockchain.com market-price chart (https://www.blockchain.com)."
    if extra not in (doc.get("attribution") or ""):
        doc["attribution"] = " ".join(x for x in [doc.get("attribution"), extra] if x)
    print(f"  Blockchain.com BTC: {len(incoming)} pts (merged {len(doc['points'])})")
    return doc


def snapshot_live() -> dict:
    now = chicago_now()
    run_date = now.strftime("%Y-%m-%d")
    fetched_at_ct = now.strftime("%Y-%m-%d %H:%M:%S CT")
    live = {}
    for asset in ASSETS:
        url = GOLD_API.format(sym=asset["gold_api"])
        data = polite_get(url, pause=0.8)
        if not data or data.get("price") is None:
            live[asset["id"]] = {"status": "error", "symbol": asset["symbol"], "name": asset["name"]}
            continue
        live[asset["id"]] = {
            "status": "ok",
            "symbol": asset["symbol"],
            "name": data.get("name") or asset["name"],
            "price": data.get("price"),
            "currency": data.get("currency") or "USD",
            "updatedAt": data.get("updatedAt"),
            "unit": asset["unit"],
            "source": "Gold API",
            "source_url": "https://gold-api.com",
        }
        print(f"  Gold API {asset['symbol']}: {data.get('price')}")

    sb = polite_get(SB_SPOT, pause=0.8)
    cg = polite_get(CG_PRICE, pause=0.8)
    return {
        "run_date": run_date,
        "fetched_at_ct": fetched_at_ct,
        "timezone": "America/Chicago",
        "live": live,
        "standard_bullion": sb,
        "coingecko": cg,
    }


def append_today(doc: dict, asset_id: str, snapshot: dict) -> dict:
    rec = (snapshot.get("live") or {}).get(asset_id) or {}
    price = rec.get("price")
    if price is None:
        return doc
    # Use Chicago calendar date at noon UTC-ish as a daily close proxy.
    t = snapshot["run_date"] + "T00:00:00Z"
    doc["points"] = merge_points(doc.get("points") or [], [{"t": t, "price": float(price)}])
    return doc


def empty_doc(asset: dict) -> dict:
    return {
        "id": asset["id"],
        "symbol": asset["symbol"],
        "name": asset["name"],
        "unit": asset["unit"],
        "points": [],
    }


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true", help="Pull public history series")
    parser.add_argument("--snapshot", action="store_true", help="Pull live prices and append today's point")
    args = parser.parse_args()
    if not args.backfill and not args.snapshot:
        args.snapshot = True

    HIST.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)

    docs = {}
    for asset in ASSETS:
        doc = load_series(asset["id"]) or empty_doc(asset)
        doc.setdefault("id", asset["id"])
        doc.setdefault("symbol", asset["symbol"])
        doc.setdefault("name", asset["name"])
        doc.setdefault("unit", asset["unit"])
        doc.setdefault("points", [])
        if args.backfill:
            print(f"Backfill {asset['symbol']}…")
            if asset.get("sb"):
                doc = backfill_standard_bullion(asset, doc)
            if asset.get("coingecko"):
                doc = backfill_coingecko(asset, doc)
            if asset["id"] == "btc":
                doc = backfill_blockchain_btc(doc)
        docs[asset["id"]] = doc

    snapshot = None
    if args.snapshot:
        print("Live snapshot…")
        snapshot = snapshot_live()
        (DATA / "latest.json").write_text(json.dumps(snapshot, indent=2) + "\n")
        for asset in ASSETS:
            docs[asset["id"]] = append_today(docs[asset["id"]], asset["id"], snapshot)

    for asset in ASSETS:
        doc = docs[asset["id"]]
        doc["updated"] = chicago_now().strftime("%Y-%m-%dT%H:%M:%S%z")
        save_series(doc)
        print(f"Wrote {asset['id']}: {len(doc.get('points') or [])} points")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
