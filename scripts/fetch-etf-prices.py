#!/usr/bin/env python3
"""Refresh public/price-book.json from justETF euro total-return charts.

Month-end levels before the current year, then every changed daily close.
Dividends are reinvested, so distributing and accumulating funds share one
return index. The retirement chart uses ratios of that index.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src/tools/etf-returns/catalog.json"
OUT = ROOT / "public/price-book.json"
PARTIAL = Path("/tmp/price-book-partial.json")
WORKERS = 6


def round_level(value: float) -> float:
    decimals = 6 if abs(value) < 2 else 4
    return round(value, decimals)


def fetch_series(isin: str, date_to: str) -> list[tuple[date, float]]:
    ranges = ("2007-01-01", "2016-01-01", "2023-01-01", f"{date_to[:4]}-01-01")
    last_error: Exception | None = None
    for start in ranges:
        url = (
            "https://www.justetf.com/api/etfs/"
            + isin
            + "/performance-chart?locale=en&currency=EUR&valuesType=MARKET_VALUE"
            + "&reduceData=true&includeDividends=true"
            + f"&dateFrom={start}&dateTo={date_to}"
        )
        for attempt in range(4):
            try:
                request = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (compatible; FinCalc/0.1; retirement-snapshot)",
                        "Accept": "application/json",
                    },
                )
                with urllib.request.urlopen(request, timeout=45) as response:
                    payload = json.loads(response.read().decode())
                points: list[tuple[date, float]] = []
                for item in payload.get("series") or []:
                    raw = (item.get("value") or {}).get("raw")
                    if raw is None:
                        continue
                    level = float(raw)
                    if not level > 0:
                        continue
                    points.append((date.fromisoformat(item["date"]), level))
                points.sort(key=lambda pair: pair[0])
                if points:
                    return points
                last_error = RuntimeError("empty series")
                break
            except urllib.error.HTTPError as error:
                last_error = error
                if error.code == 404:
                    return []
                if error.code == 400:
                    break
                time.sleep(1.5 * (attempt + 1))
            except Exception as error:  # noqa: BLE001 - keep the batch moving
                last_error = error
                time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    return []


def sample(points: list[tuple[date, float]], daily_from: date) -> list[list[float]]:
    monthly: dict[tuple[int, int], tuple[date, float]] = {}
    daily: list[tuple[date, float]] = []
    for day, level in points:
        if day >= daily_from:
            daily.append((day, level))
        else:
            monthly[(day.year, day.month)] = (day, level)
    sampled: list[tuple[date, float]] = [monthly[key] for key in sorted(monthly)]
    previous: float | None = sampled[-1][1] if sampled else None
    for index, (day, level) in enumerate(daily):
        last = index == len(daily) - 1
        changed = previous is None or abs(level - previous) > 1e-8
        if not changed and not last:
            continue
        if sampled and sampled[-1][0] == day:
            sampled[-1] = (day, level)
        else:
            sampled.append((day, level))
        previous = level
    return [[int(day.strftime("%Y%m%d")), round_level(level)] for day, level in sampled]


def main() -> None:
    today = date.today()
    date_to = today.isoformat()
    daily_from = date(today.year, 1, 1)
    catalog = json.loads(CATALOG.read_text())
    isins = [row["isin"] for row in catalog]
    done: dict[str, list[list[float]]] = {}
    if PARTIAL.exists():
        done = json.loads(PARTIAL.read_text())
    pending = [isin for isin in isins if isin not in done]
    print(f"{len(isins)} funds, {len(done)} already saved, {len(pending)} to fetch", flush=True)
    failures: list[str] = []
    started = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch_series, isin, date_to): isin for isin in pending}
        for count, future in enumerate(as_completed(futures), start=1):
            isin = futures[future]
            try:
                points = future.result()
                done[isin] = sample(points, daily_from) if points else []
            except Exception as error:  # noqa: BLE001
                failures.append(f"{isin} {error}")
                done[isin] = []
            if count % 25 == 0 or count == len(pending):
                PARTIAL.write_text(json.dumps(done))
                print(
                    f"{count}/{len(pending)} in {time.time() - started:.0f}s failures {len(failures)}",
                    flush=True,
                )
    series = {isin: pairs for isin, pairs in done.items() if pairs}
    lasts = [int(pairs[-1][0]) for pairs in series.values()]
    as_of_stamp = Counter(lasts).most_common(1)[0][0] if lasts else int(today.strftime("%Y%m%d"))
    as_of = datetime.strptime(str(as_of_stamp), "%Y%m%d").date().isoformat()
    OUT.write_text(json.dumps({"asOf": as_of, "series": series}, separators=(",", ":")))
    print(
        f"wrote {OUT} asOf {as_of} series {len(series)} bytes {OUT.stat().st_size} failures {len(failures)}",
        flush=True,
    )
    if failures:
        print("\n".join(failures[:40]), flush=True)


if __name__ == "__main__":
    main()
