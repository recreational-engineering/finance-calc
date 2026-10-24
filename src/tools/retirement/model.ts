import { dayLabel, formatShare, monthLabel } from '../../platform/format';
import { effectiveMonthlyRate, finiteOr } from '../../platform/rates';
import { DEFAULT_ASSUMPTIONS } from '../etf-returns/assumptions';
import { requireEtf } from '../etf-returns/catalog';
import { estimateEtf, planningRatePercent } from '../etf-returns/model';

export interface SavingsEntry {
  id: string;
  name: string;
  monthlyPayment: number;
  yearlyInterestPercent: number;
  /** Set when the interest came from an ETF planning rate. */
  isin?: string;
}

function etfEntry(isin: string, monthlyPayment: number): SavingsEntry {
  const product = requireEtf(isin);
  return {
    id: isin,
    isin,
    name: product.shortName,
    monthlyPayment,
    yearlyInterestPercent: planningRatePercent(estimateEtf(product, DEFAULT_ASSUMPTIONS)),
  };
}

export interface RetirementInput {
  startDate: string;
  years: number;
  entries: SavingsEntry[];
}

export interface RetirementPoint {
  month: number;
  label: string;
  total: number;
  values: Record<string, number>;
}

export interface RetirementEntryResult {
  id: string;
  name: string;
  colorIndex: number;
  capital: number;
  fraction: number;
  contributed: number;
  growth: number;
  monthlyPayment: number;
  yearlyInterestPercent: number;
}

export interface RetirementResult {
  points: RetirementPoint[];
  entries: RetirementEntryResult[];
  total: number;
  totalContributed: number;
  warnings: string[];
}

export const DEFAULT_RETIREMENT: RetirementInput = {
  startDate: '2026-08-01',
  years: 30,
  entries: [
    etfEntry('FR0014010HV4', 200),
    etfEntry('IE00BM67HM91', 200),
    etfEntry('IE000ROSD5J6', 200),
    etfEntry('LU1861132840', 50),
    etfEntry('DE000A0S9GB0', 50),
  ],
};

export function reviveRetirement(value: unknown): RetirementInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<RetirementInput>;
  if (!Array.isArray(raw.entries)) return null;
  const entries = raw.entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Partial<SavingsEntry>;
    if (typeof item.id !== 'string') return [];
    return [
      {
        id: item.id,
        name: typeof item.name === 'string' ? item.name : 'Entry',
        monthlyPayment: Number(item.monthlyPayment),
        yearlyInterestPercent: Number(item.yearlyInterestPercent),
        isin: typeof item.isin === 'string' ? item.isin : undefined,
      },
    ];
  });
  return {
    startDate: typeof raw.startDate === 'string' ? raw.startDate : DEFAULT_RETIREMENT.startDate,
    years: Number(raw.years),
    entries,
  };
}

/**
 * Each entry compounds on its own. The deposit lands at month end, so it earns
 * interest from the following month. The yearly rate is an effective annual rate:
 * the monthly rate is (1 + r) ^ (1/12) − 1.
 */
export function simulateRetirement(input: RetirementInput): RetirementResult {
  const warnings: string[] = [];
  const horizon = resolvedHorizon(input.years);
  if (horizon.months <= 0) {
    return { points: [], entries: [], total: 0, totalContributed: 0, warnings: ['Set a horizon of at least one year.'] };
  }
  if (horizon.warning) warnings.push(horizon.warning);
  const months = horizon.months;
  const entries = input.entries.filter((entry) => entry.id);
  if (entries.length === 0) warnings.push('Add at least one savings entry.');

  const usable = entries.filter((entry) => {
    const rate = finiteOr(entry.yearlyInterestPercent, 0);
    if (rate <= -100) {
      warnings.push(`${entry.name.trim() || 'An entry'} needs an interest rate above −100%.`);
      return false;
    }
    return true;
  });
  const balances = new Map<string, number>(usable.map((entry) => [entry.id, 0]));
  const contributed = new Map<string, number>(usable.map((entry) => [entry.id, 0]));
  const points: RetirementPoint[] = [];

  const snapshot = (month: number) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const entry of usable) {
      const value = balances.get(entry.id) ?? 0;
      values[entry.id] = value;
      total += value;
    }
    points.push({
      month,
      label: monthLabel(input.startDate, month),
      total,
      values,
    });
  };

  snapshot(0);
  for (let month = 1; month <= months; month += 1) {
    for (const entry of usable) {
      const payment = Math.max(0, finiteOr(entry.monthlyPayment, 0));
      const rate = finiteOr(entry.yearlyInterestPercent, 0);
      const balance = (balances.get(entry.id) ?? 0) * (1 + effectiveMonthlyRate(rate)) + payment;
      balances.set(entry.id, balance);
      contributed.set(entry.id, (contributed.get(entry.id) ?? 0) + payment);
    }
    snapshot(month);
  }

  const total = points[points.length - 1]?.total ?? 0;
  const entryResults: RetirementEntryResult[] = usable.map((entry, index) => {
    const capital = balances.get(entry.id) ?? 0;
    const paid = contributed.get(entry.id) ?? 0;
    return {
      id: entry.id,
      name: entry.name.trim() || `Entry ${index + 1}`,
      colorIndex: index,
      capital,
      fraction: total > 0 ? capital / total : 0,
      contributed: paid,
      growth: capital - paid,
      monthlyPayment: Math.max(0, finiteOr(entry.monthlyPayment, 0)),
      yearlyInterestPercent: finiteOr(entry.yearlyInterestPercent, 0),
    };
  });

  return {
    points,
    entries: entryResults,
    total,
    totalContributed: entryResults.reduce((sum, entry) => sum + entry.contributed, 0),
    warnings: unique(warnings),
  };
}

export function shareLabel(fraction: number): string {
  return formatShare(fraction);
}

function unique(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Euro total-return index. `dates` are YYYYMMDD and line up with `levels`. */
export interface PriceSeries {
  dates: readonly number[];
  levels: readonly number[];
}

export interface PriceBook {
  /** Latest quote date in the snapshot, YYYY-MM-DD. */
  asOf: string;
  series: Readonly<Record<string, PriceSeries>>;
}

export interface ActualEntry {
  id: string;
  priced: boolean;
  contributed: number;
  /** Market value, or the estimate when this entry has no price. */
  capital: number;
  marketCapital: number | null;
  predictedCapital: number;
}

export interface ActualPoint {
  month: number;
  label: string;
  /** Market value of priced entries plus the estimate for the rest. */
  total: number;
}

export interface ActualPath {
  asOf: string;
  /** Month index of `asOf`. Fractional when that day is not a deposit date. */
  elapsed: number;
  contributed: number;
  total: number;
  predictedTotal: number;
  marketTotal: number;
  entries: ActualEntry[];
  points: ActualPoint[];
  warnings: string[];
  /** False when every entry lacks a price, so a line would only repeat the estimate. */
  hasMarket: boolean;
}

function resolvedHorizon(yearsInput: number): { months: number; warning?: string } {
  const years = finiteOr(yearsInput, 0);
  if (!(years > 0)) return { months: 0 };
  const capped = Math.min(years, 80);
  return {
    months: Math.round(capped * 12),
    warning: years > 80 ? 'The horizon is capped at 80 years.' : undefined,
  };
}

export function addMonthsIso(iso: string, months: number): string {
  if (!ISO_DATE.test(iso)) return iso;
  const [yearText, monthText, dayText] = iso.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1 + months;
  const day = Number(dayText);
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  const y = String(targetYear).padStart(4, '0');
  const m = String(targetMonth + 1).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
}

/** Whole deposit dates since `start`, plus the fraction of the month still open. */
export function elapsedMonths(start: string, date: string): number {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(date) || date <= start) return 0;
  const [startYear, startMonth] = start.split('-').map(Number);
  const [year, month] = date.split('-').map(Number);
  let whole = (year - startYear) * 12 + (month - startMonth);
  if (addMonthsIso(start, whole) > date) whole -= 1;
  if (whole < 0) return 0;
  const periodStart = addMonthsIso(start, whole);
  const periodEnd = addMonthsIso(start, whole + 1);
  const span = daysBetween(periodStart, periodEnd);
  if (span <= 0) return whole;
  return whole + daysBetween(periodStart, date) / span;
}

/**
 * Price level after `elapsed` months at a constant effective annual rate.
 * A balance divided by this is its buying power in start-date euros.
 */
export function priceLevel(annualPercent: number, elapsed: number): number {
  if (!Number.isFinite(annualPercent) || !Number.isFinite(elapsed) || annualPercent <= -100) return Number.NaN;
  if (elapsed === 0 || annualPercent === 0) return 1;
  return Math.pow(1 + annualPercent / 100, elapsed / 12);
}

/** `nominal` restated in start-date euros at a constant inflation rate. */
export function buyingPower(nominal: number, inflationPercent: number, elapsed: number): number {
  const level = priceLevel(inflationPercent, elapsed);
  if (!(level > 0) || !Number.isFinite(nominal)) return Number.NaN;
  return nominal / level;
}

/**
 * Buying power, in start-date euros, of the deposits made by `elapsed`.
 * A partial month adds no deposit. This equals the buying power of a balance
 * that earned exactly `inflationPercent`.
 */
export function contributionBuyingPower(payment: number, inflationPercent: number, elapsed: number): number {
  if (!Number.isFinite(inflationPercent) || inflationPercent <= -100 || !Number.isFinite(elapsed)) return Number.NaN;
  const whole = Math.floor(elapsed + 1e-9);
  const pay = Math.max(0, finiteOr(payment, 0));
  if (whole <= 0 || pay === 0) return 0;
  const monthly = effectiveMonthlyRate(inflationPercent);
  if (monthly === 0) return pay * whole;
  return (pay * (1 - Math.pow(1 + monthly, -whole))) / monthly;
}

/** Balance after `elapsed` months, with the same month-end deposits as the estimate. */
export function compoundedBalance(payment: number, annualPercent: number, elapsed: number): number {
  if (!(elapsed > 0)) return 0;
  const whole = Math.floor(elapsed + 1e-9);
  const fraction = Math.max(0, elapsed - whole);
  const rate = effectiveMonthlyRate(annualPercent);
  const pay = Math.max(0, finiteOr(payment, 0));
  let balance = 0;
  for (let month = 0; month < whole; month += 1) {
    balance = balance * (1 + rate) + pay;
  }
  if (fraction > 1e-9) balance *= Math.pow(1 + rate, fraction);
  return balance;
}

function isoStamp(iso: string): number {
  return Number(iso.replaceAll('-', ''));
}

function stampToIso(stamp: number): string {
  const text = String(stamp).padStart(8, '0');
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function levelOnOrBefore(series: PriceSeries, stamp: number): number | null {
  let low = 0;
  let high = series.dates.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (series.dates[mid] <= stamp) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found < 0 ? null : series.levels[found];
}

function firstIndexOnOrAfter(series: PriceSeries, stamp: number): number | null {
  let low = 0;
  let high = series.dates.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (series.dates[mid] >= stamp) {
      found = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return found < 0 ? null : found;
}

/** Grow a balance by the total-return index. Cash until the first price. */
function grow(balance: number, series: PriceSeries, fromIso: string, toIso: string): number {
  if (balance === 0) return 0;
  const fromStamp = isoStamp(fromIso);
  const toStamp = isoStamp(toIso);
  let fromLevel = levelOnOrBefore(series, fromStamp);
  if (fromLevel == null) {
    const index = firstIndexOnOrAfter(series, fromStamp);
    if (index == null || series.dates[index] > toStamp) return balance;
    fromLevel = series.levels[index];
  }
  const toLevel = levelOnOrBefore(series, toStamp);
  if (toLevel == null || fromLevel === 0) return balance;
  return balance * (toLevel / fromLevel);
}

function marketSeries(
  book: PriceBook,
  isin: string | undefined,
  start: string,
  asOf: string,
): PriceSeries | null {
  if (!isin) return null;
  const series = book.series[isin];
  if (!series || series.dates.length === 0) return null;
  if (series.dates[series.dates.length - 1] < isoStamp(start)) return null;
  if (series.dates[0] > isoStamp(asOf)) return null;
  return series;
}

function earlierDate(left: string, right: string): string {
  return left < right ? left : right;
}

/**
 * Market value of the same month-end deposits, from the start through the
 * latest quote that is still inside the plan. Priced entries grow by the ETF
 * total-return index. An entry with no price keeps its yearly interest, so the
 * line stays comparable with the stacked estimate.
 */
export function actualRetirement(
  input: RetirementInput,
  book: PriceBook,
  today: string,
): ActualPath | null {
  if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(today) || !ISO_DATE.test(book.asOf)) return null;
  const horizon = resolvedHorizon(input.years);
  if (horizon.months <= 0) return null;
  const asOf = earlierDate(earlierDate(today, book.asOf), addMonthsIso(input.startDate, horizon.months));
  if (!(asOf > input.startDate)) return null;

  const usable = input.entries.filter((entry) => {
    if (!entry.id) return false;
    return finiteOr(entry.yearlyInterestPercent, 0) > -100;
  });
  if (usable.length === 0) return null;

  const elapsed = elapsedMonths(input.startDate, asOf);
  const whole = Math.floor(elapsed + 1e-9);
  const fraction = Math.max(0, elapsed - whole);
  const warnings: string[] = [];

  interface Lane {
    entry: SavingsEntry;
    series: PriceSeries | null;
    balance: number;
    paid: number;
    cursor: string;
    payment: number;
    rate: number;
  }

  const lanes: Lane[] = usable.map((entry) => {
    const series = marketSeries(book, entry.isin, input.startDate, asOf);
    const name = entry.name.trim() || entry.isin || 'An entry';
    if (!series) {
      warnings.push(
        entry.isin
          ? `${name} has no euro price in this snapshot, so its part of the market line uses the yearly interest.`
          : `${name} has no ETF, so its part of the market line uses the yearly interest.`,
      );
    } else {
      const lastIso = stampToIso(series.dates[series.dates.length - 1]);
      if (daysBetween(lastIso, asOf) > 7) {
        warnings.push(`${name} prices end on ${dayLabel(lastIso)}, so later days stay flat.`);
      }
    }
    return {
      entry,
      series,
      balance: 0,
      paid: 0,
      cursor: input.startDate,
      payment: Math.max(0, finiteOr(entry.monthlyPayment, 0)),
      rate: effectiveMonthlyRate(finiteOr(entry.yearlyInterestPercent, 0)),
    };
  });

  const hasMarket = lanes.some((lane) => lane.series);
  const points: ActualPoint[] = [{ month: 0, label: monthLabel(input.startDate, 0), total: 0 }];
  const snapshot = (month: number, label: string) => {
    points.push({
      month,
      label,
      total: lanes.reduce((sum, lane) => sum + lane.balance, 0),
    });
  };

  for (let month = 1; month <= whole; month += 1) {
    const next = addMonthsIso(input.startDate, month);
    for (const lane of lanes) {
      lane.balance = lane.series
        ? grow(lane.balance, lane.series, lane.cursor, next)
        : lane.balance * (1 + lane.rate);
      lane.balance += lane.payment;
      lane.paid += lane.payment;
      lane.cursor = next;
    }
    snapshot(month, monthLabel(input.startDate, month));
  }

  if (fraction > 1e-6) {
    for (const lane of lanes) {
      lane.balance = lane.series
        ? grow(lane.balance, lane.series, lane.cursor, asOf)
        : lane.balance * Math.pow(1 + lane.rate, fraction);
      lane.cursor = asOf;
    }
    snapshot(elapsed, dayLabel(asOf));
  }

  const entries: ActualEntry[] = lanes.map((lane) => {
    const predictedCapital = compoundedBalance(
      lane.payment,
      finiteOr(lane.entry.yearlyInterestPercent, 0),
      elapsed,
    );
    return {
      id: lane.entry.id,
      priced: lane.series != null,
      contributed: lane.paid,
      capital: lane.balance,
      marketCapital: lane.series ? lane.balance : null,
      predictedCapital,
    };
  });
  const marketTotal = entries.reduce((sum, entry) => sum + (entry.marketCapital ?? 0), 0);

  return {
    asOf,
    elapsed,
    contributed: entries.reduce((sum, entry) => sum + entry.contributed, 0),
    total: entries.reduce((sum, entry) => sum + entry.capital, 0),
    predictedTotal: entries.reduce((sum, entry) => sum + entry.predictedCapital, 0),
    marketTotal,
    entries,
    points,
    warnings: hasMarket
      ? unique(warnings)
      : ['None of the entries have a euro price in this snapshot, so there is no market line.'],
    hasMarket,
  };
}
