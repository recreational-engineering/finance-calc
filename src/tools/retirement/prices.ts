import type { PriceBook, PriceSeries } from './model';

/**
 * Euro total-return indexes (justETF, dividends reinvested), snapshot 23 Oct 2026.
 * Month-end levels before 2026, then each changed daily close. Ratios of the
 * index are the market return. Refresh with `scripts/fetch-etf-prices.py`.
 */

interface PriceBookFile {
  asOf: string;
  series: Record<string, number[][]>;
}

export function parsePriceBook(raw: unknown): PriceBook {
  if (!raw || typeof raw !== 'object') throw new Error('Price book is not an object');
  const body = raw as Partial<PriceBookFile>;
  if (typeof body.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.asOf)) {
    throw new Error('Price book has no as-of date');
  }
  if (!body.series || typeof body.series !== 'object') throw new Error('Price book has no series');

  const series: Record<string, PriceSeries> = {};
  for (const [isin, pairs] of Object.entries(body.series)) {
    if (!Array.isArray(pairs)) continue;
    const cleaned: { date: number; level: number }[] = [];
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const date = Number(pair[0]);
      const level = Number(pair[1]);
      if (!Number.isFinite(date) || !Number.isFinite(level) || !(level > 0)) continue;
      cleaned.push({ date, level });
    }
    cleaned.sort((left, right) => left.date - right.date);
    const dates: number[] = [];
    const levels: number[] = [];
    for (const point of cleaned) {
      if (dates.length > 0 && dates[dates.length - 1] === point.date) {
        levels[levels.length - 1] = point.level;
        continue;
      }
      dates.push(point.date);
      levels.push(point.level);
    }
    if (dates.length > 0) series[isin] = { dates, levels };
  }
  return { asOf: body.asOf, series };
}

let pending: Promise<PriceBook> | null = null;

export function loadPriceBook(): Promise<PriceBook> {
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}price-book.json`;
    pending = fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Market prices failed to load (${response.status}).`);
        return parsePriceBook(await response.json());
      })
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
