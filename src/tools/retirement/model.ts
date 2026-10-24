import { formatShare, monthLabel } from '../../platform/format';
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
  startDate: '2026-10-01',
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
  const years = finiteOr(input.years, 0);
  if (!(years > 0)) {
    return { points: [], entries: [], total: 0, totalContributed: 0, warnings: ['Set a horizon of at least one year.'] };
  }
  const cappedYears = Math.min(years, 80);
  if (years > 80) warnings.push('The horizon is capped at 80 years.');
  const months = Math.round(cappedYears * 12);
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
