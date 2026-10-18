import { describe, expect, it } from 'vitest';
import { monthLabel } from '../../platform/format';
import { effectiveMonthlyRate } from '../../platform/rates';
import { DEFAULT_RETIREMENT, simulateRetirement, type SavingsEntry } from './model';

function futureValue(payment: number, annualPercent: number, years: number): number {
  const rate = effectiveMonthlyRate(annualPercent);
  const months = years * 12;
  if (rate === 0) return payment * months;
  return (payment * (Math.pow(1 + rate, months) - 1)) / rate;
}

function only(entry: SavingsEntry, years = 10) {
  return simulateRetirement({ startDate: '2026-10-01', years, entries: [entry] });
}

describe('simulateRetirement', () => {
  it('matches the end-of-month annuity future value', () => {
    const result = only({
      id: 'a',
      name: 'ETF',
      monthlyPayment: 100,
      yearlyInterestPercent: 6,
    });
    expect(result.total).toBeCloseTo(futureValue(100, 6, 10), 6);
    expect(result.entries[0].contributed).toBe(12_000);
    expect(result.entries[0].growth).toBeCloseTo(result.total - 12_000, 6);
  });

  it('sums payments when interest is zero', () => {
    const result = only({
      id: 'cash',
      name: 'Cash',
      monthlyPayment: 250,
      yearlyInterestPercent: 0,
    }, 4);
    expect(result.total).toBe(250 * 48);
    expect(result.entries[0].fraction).toBe(1);
  });

  it('keeps entries independent and reports shares that sum to one', () => {
    const result = simulateRetirement({
      ...DEFAULT_RETIREMENT,
      years: 20,
    });
    const separate = DEFAULT_RETIREMENT.entries.map((entry) => only(entry, 20).total);
    result.entries.forEach((entry, index) => {
      expect(entry.capital).toBeCloseTo(separate[index], 4);
    });
    const share = result.entries.reduce((sum, entry) => sum + entry.fraction, 0);
    expect(share).toBeCloseTo(1, 8);
    expect(result.total).toBeCloseTo(separate.reduce((sum, value) => sum + value, 0), 4);
  });

  it('gives the higher rate a larger capital when payments match', () => {
    const result = simulateRetirement({
      startDate: '2026-01-01',
      years: 15,
      entries: [
        { id: 'low', name: 'Low', monthlyPayment: 400, yearlyInterestPercent: 2 },
        { id: 'high', name: 'High', monthlyPayment: 400, yearlyInterestPercent: 7 },
      ],
    });
    const low = result.entries.find((entry) => entry.id === 'low');
    const high = result.entries.find((entry) => entry.id === 'high');
    expect(high && low && high.capital).toBeGreaterThan(low?.capital ?? 0);
  });

  it('labels months from the start date and begins at zero', () => {
    const result = only({
      id: 'a',
      name: 'A',
      monthlyPayment: 10,
      yearlyInterestPercent: 0,
    }, 1);
    expect(result.points[0].total).toBe(0);
    expect(result.points[0].label).toBe(monthLabel('2026-10-01', 0));
    expect(result.points[12].label).toBe('Oct 2027');
    expect(result.points).toHaveLength(13);
  });

  it('rejects a missing horizon', () => {
    const result = simulateRetirement({ startDate: '2026-10-01', years: 0, entries: [] });
    expect(result.points).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
