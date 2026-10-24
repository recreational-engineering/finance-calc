import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarToday, dayLabel, monthLabel } from '../../platform/format';
import { effectiveMonthlyRate } from '../../platform/rates';
import {
  DEFAULT_RETIREMENT,
  actualRetirement,
  addMonthsIso,
  buyingPower,
  compoundedBalance,
  contributionBuyingPower,
  elapsedMonths,
  priceLevel,
  simulateRetirement,
  type PriceBook,
  type SavingsEntry,
} from './model';
import { parsePriceBook } from './prices';

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

  it('starts from the DKB example portfolio', () => {
    expect(DEFAULT_RETIREMENT.startDate).toBe('2026-08-01');
    expect(DEFAULT_RETIREMENT.entries.map((entry) => [entry.isin, entry.monthlyPayment])).toEqual([
      ['FR0014010HV4', 200],
      ['IE00BM67HM91', 200],
      ['IE000ROSD5J6', 200],
      ['LU1861132840', 50],
      ['DE000A0S9GB0', 50],
    ]);
    for (const entry of DEFAULT_RETIREMENT.entries) {
      expect(entry.yearlyInterestPercent).toBeGreaterThan(0);
      expect(entry.yearlyInterestPercent).toBeLessThan(20);
    }
  });

  it('rejects a missing horizon', () => {
    const result = simulateRetirement({ startDate: '2026-10-01', years: 0, entries: [] });
    expect(result.points).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('inflation', () => {
  it('restates a balance in start-date euros', () => {
    expect(priceLevel(2, 0)).toBe(1);
    expect(priceLevel(0, 36)).toBe(1);
    expect(priceLevel(2, 12)).toBeCloseTo(1.02, 10);
    expect(buyingPower(102, 2, 12)).toBeCloseTo(100, 8);
    expect(buyingPower(50, 0, 10)).toBe(50);
    expect(priceLevel(-100, 12)).toBeNaN();
  });

  it('treats an inflation-only balance as unchanged buying power', () => {
    const payment = 125;
    const inflation = 2;
    const elapsed = 15 * 12 + 0.4;
    const whole = Math.floor(elapsed + 1e-9);
    const atDeposit = compoundedBalance(payment, inflation, whole);
    const later = compoundedBalance(payment, inflation, elapsed);
    const deposits = contributionBuyingPower(payment, inflation, elapsed);
    expect(buyingPower(atDeposit, inflation, whole)).toBeCloseTo(deposits, 6);
    expect(buyingPower(later, inflation, elapsed)).toBeCloseTo(deposits, 6);
    expect(contributionBuyingPower(payment, 0, 24)).toBe(payment * 24);
  });

  it('counts buying power above the deposits when the return beats inflation', () => {
    const nominal = compoundedBalance(100, 6, 120);
    const power = buyingPower(nominal, 2, 120);
    const deposits = contributionBuyingPower(100, 2, 120);
    expect(power).toBeGreaterThan(deposits);
    expect(power).toBeLessThan(nominal);
  });
});

describe('market path', () => {
  const book: PriceBook = {
    asOf: '2026-10-23',
    series: {
      ETF: {
        dates: [20260801, 20260901, 20261001, 20261023],
        levels: [100, 100, 110, 121],
      },
    },
  };

  it('counts deposit dates from the start and labels the latest quote', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29');
    expect(elapsedMonths('2026-08-01', '2026-08-01')).toBe(0);
    expect(elapsedMonths('2026-08-01', '2026-09-01')).toBe(1);
    expect(elapsedMonths('2026-08-01', '2026-10-23')).toBeCloseTo(2 + 22 / 31, 10);
    expect(dayLabel('2026-10-23')).toBe('23 Oct 2026');
    expect(calendarToday('Europe/Berlin', new Date('2026-10-24T21:30:00Z'))).toBe('2026-10-24');
    expect(calendarToday('Europe/Berlin', new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
  });

  it('grows deposits by the total-return index and stops at the quote', () => {
    const path = actualRetirement(
      {
        startDate: '2026-08-01',
        years: 30,
        entries: [
          { id: 'ETF', isin: 'ETF', name: 'Energy', monthlyPayment: 100, yearlyInterestPercent: 0 },
          { id: 'cash', name: 'Cash', monthlyPayment: 50, yearlyInterestPercent: 0 },
        ],
      },
      book,
      '2026-10-24',
    );
    expect(path?.asOf).toBe('2026-10-23');
    expect(path?.elapsed).toBeCloseTo(2 + 22 / 31, 8);
    expect(path?.contributed).toBe(300);
    const energy = path?.entries.find((entry) => entry.id === 'ETF');
    const cash = path?.entries.find((entry) => entry.id === 'cash');
    expect(energy?.marketCapital).toBeCloseTo(231, 6);
    expect(energy?.predictedCapital).toBeCloseTo(200, 6);
    expect(cash?.priced).toBe(false);
    expect(cash?.capital).toBeCloseTo(100, 6);
    expect(path?.total).toBeCloseTo(331, 6);
    expect(path?.marketTotal).toBeCloseTo(231, 6);
    expect(path?.points.map((point) => point.total)).toHaveLength(4);
    expect(path?.points[0].total).toBe(0);
    expect(path?.points[1].total).toBeCloseTo(150, 6);
    expect(path?.points[2].total).toBeCloseTo(310, 6);
    expect(path?.points[3].label).toBe('23 Oct 2026');
    expect(path?.warnings[0]).toMatch(/Cash has no ETF/);
  });

  it('holds cash until the fund has a price', () => {
    const late: PriceBook = {
      asOf: '2026-10-23',
      series: { ETF: { dates: [20261001, 20261023], levels: [100, 110] } },
    };
    const path = actualRetirement(
      {
        startDate: '2026-08-01',
        years: 5,
        entries: [{ id: 'ETF', isin: 'ETF', name: 'New', monthlyPayment: 100, yearlyInterestPercent: 0 }],
      },
      late,
      '2026-10-24',
    );
    expect(path?.entries[0].marketCapital).toBeCloseTo(220, 6);
  });

  it('matches the estimate at a whole number of months', () => {
    expect(compoundedBalance(100, 6, 120)).toBeCloseTo(futureValue(100, 6, 10), 6);
    const rate = effectiveMonthlyRate(6);
    const twoMonths = compoundedBalance(100, 6, 2);
    expect(compoundedBalance(100, 6, 2.5)).toBeCloseTo(twoMonths * Math.pow(1 + rate, 0.5), 8);
    const result = simulateRetirement({
      startDate: '2026-08-01',
      years: 10,
      entries: [{ id: 'a', name: 'A', monthlyPayment: 100, yearlyInterestPercent: 6 }],
    });
    expect(result.points[120].total).toBeCloseTo(compoundedBalance(100, 6, 120), 6);
  });

  it('does not draw a path before the plan starts or past the horizon', () => {
    expect(actualRetirement({ ...DEFAULT_RETIREMENT, startDate: '2026-11-01' }, book, '2026-10-24')).toBeNull();
    const path = actualRetirement(
      {
        startDate: '2020-01-01',
        years: 1,
        entries: [{ id: 'ETF', isin: 'ETF', name: 'ETF', monthlyPayment: 10, yearlyInterestPercent: 0 }],
      },
      {
        asOf: '2026-10-23',
        series: { ETF: { dates: [20200101, 20210101, 20261023], levels: [10, 20, 40] } },
      },
      '2026-10-24',
    );
    expect(path?.asOf).toBe('2021-01-01');
    expect(path?.contributed).toBe(120);
    expect(path?.entries[0].marketCapital).toBeGreaterThan(120);
  });

  it('prices the example plan through the snapshot', () => {
    const snapshot = parsePriceBook(JSON.parse(readFileSync('public/price-book.json', 'utf8')));
    expect(snapshot.asOf).toBe('2026-10-23');
    const path = actualRetirement(DEFAULT_RETIREMENT, snapshot, '2026-10-24');
    expect(path?.hasMarket).toBe(true);
    expect(path?.entries.every((entry) => entry.priced)).toBe(true);
    expect(path?.contributed).toBe(1_400);
    expect(path?.asOf).toBe('2026-10-23');
    let market = 0;
    for (const entry of DEFAULT_RETIREMENT.entries) {
      const series = snapshot.series[entry.isin ?? ''];
      const level = (stamp: number) => {
        let found = 0;
        for (let index = 0; index < series.dates.length; index += 1) {
          if (series.dates[index] <= stamp) found = series.levels[index];
          else break;
        }
        return found;
      };
      const first = entry.monthlyPayment;
      const atOctober = first * (level(20261001) / level(20260901)) + entry.monthlyPayment;
      market += atOctober * (level(20261023) / level(20261001));
    }
    expect(path?.total).toBeCloseTo(market, 4);
    expect(path?.total).not.toBeCloseTo(path?.predictedTotal ?? 0, 0);
  });
});
