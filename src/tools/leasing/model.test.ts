import { describe, expect, it } from 'vitest';
import { DEFAULT_LEASING, carValueAtYear, simulateLeasing, type LeasingInput } from './model';

const quiet: LeasingInput = {
  ...DEFAULT_LEASING,
  horizonYears: 6,
  msciReturnPercent: 0,
  applyEtfTax: false,
  basiszinsPercent: 0,
  allowance: 0,
  financePurchase: false,
};

describe('car value', () => {
  it('drops hardest in year one and then compounds', () => {
    expect(carValueAtYear(35_000, 0, 0.22, 0.12)).toBe(35_000);
    expect(carValueAtYear(35_000, 1, 0.22, 0.12)).toBeCloseTo(35_000 * 0.78, 6);
    expect(carValueAtYear(35_000, 3, 0.22, 0.12)).toBeCloseTo(35_000 * 0.78 * 0.88 ** 2, 6);
    expect(carValueAtYear(35_000, 0.5, 0.22, 0.12)).toBeCloseTo(35_000 * (1 - 0.11), 6);
  });
});

describe('simulateLeasing', () => {
  it('turns the leasing factor into a monthly rate on the list price', () => {
    const result = simulateLeasing(DEFAULT_LEASING);
    expect(result.monthlyLease).toBeCloseTo(38_000 * 0.95 / 100, 8);
    expect(result.contracts).toBe(2);
    expect(result.finalCarValue).toBeCloseTo(35_000 * 0.78 * 0.88 ** 5, 4);
    expect(result.totals.transferFees).toBe(1800);
    expect(result.loan).toBe(0);
  });

  it('invests exactly the cash the other life spends', () => {
    const result = simulateLeasing(quiet);
    let expected = result.buyerInitialCash - result.lesseeInitialCash;
    for (const point of result.points) {
      if (point.month === 0) continue;
      expected += point.buyerCash - point.lesseeCash;
    }
    expect(
      result.totals.lesseeEtfContributions - result.totals.buyerEtfContributions,
    ).toBeCloseTo(expected, 4);
    expect(result.finalLesseeNet).toBeCloseTo(result.totals.lesseeEtfContributions, 4);
  });

  it('favours leasing when the car falls fast and the ETF is strong', () => {
    const result = simulateLeasing({
      ...quiet,
      leasingFactor: 0.7,
      firstYearDropPercent: 30,
      laterDropPercent: 15,
      msciReturnPercent: 12,
      transferFee: 0,
      specialPayment: 0,
    });
    expect(result.finalLesseeNet).toBeGreaterThan(result.finalBuyerNet);
  });

  it('favours buying when the lease is expensive and the ETF does not grow', () => {
    const result = simulateLeasing({
      ...quiet,
      leasingFactor: 2.4,
      firstYearDropPercent: 8,
      laterDropPercent: 6,
      msciReturnPercent: 0,
      ownerMaintenanceBase: 0,
      ownerMaintenanceAgeStep: 0,
      leaseMaintenance: 0,
      transferFee: 0,
      registrationFee: 0,
    });
    expect(result.finalBuyerNet).toBeGreaterThan(result.finalLesseeNet);
  });
});
