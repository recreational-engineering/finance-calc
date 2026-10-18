import { describe, expect, it } from 'vitest';
import { DEFAULT_HOUSING, simulateHousing, type HousingInput } from './model';

const quiet: HousingInput = {
  ...DEFAULT_HOUSING,
  horizonYears: 10,
  areaSqm: 50,
  pricePerSqm: 1000,
  coldRentPerSqm: 5,
  rentGrowthPercent: 0,
  appreciationPercent: 0,
  downPaymentPercent: 20,
  transferTaxPercent: 10,
  notaryPercent: 0,
  brokerPercent: 0,
  mortgageRatePercent: 0,
  initialRepaymentPercent: 10,
  maintenancePerSqmMonth: 0,
  adminMonthly: 0,
  grundsteuerMonthly: 0,
  insuranceMonthly: 0,
  ownerCostInflationPercent: 0,
  sellingCostPercent: 0,
  assumeSale: false,
  msciReturnPercent: 0,
  applyEtfTax: false,
};

describe('simulateHousing', () => {
  it('prices the Munich default flat and the German instalment', () => {
    const result = simulateHousing(DEFAULT_HOUSING);
    expect(result.purchasePrice).toBe(660_000);
    expect(result.closingCosts).toBeCloseTo(660_000 * 0.0907, 6);
    expect(result.downPayment).toBe(132_000);
    expect(result.loan).toBe(528_000);
    expect(result.initialCash).toBeCloseTo(191_862, 6);
    expect(result.monthlyMortgage).toBeCloseTo(2860, 6);
    expect(result.startingRent).toBeCloseTo(1717.5, 6);
    expect(result.points[1].buyerCash).toBeCloseTo(2860 + 150 + 30 + 40 + 25, 6);
    expect(result.points[1].renterCash).toBeCloseTo(1717.5, 6);
    expect(result.payoffMonth).not.toBeNull();
    expect(result.payoffMonth ?? 0).toBeGreaterThan(25 * 12);
    expect(result.payoffMonth ?? 0).toBeLessThan(40 * 12);
  });

  it('compounds property value at the effective annual rate', () => {
    const result = simulateHousing({
      ...quiet,
      horizonYears: 2,
      appreciationPercent: 2,
    });
    const start = result.points[0].propertyValue;
    expect(result.points[12].propertyValue).toBeCloseTo(start * 1.02, 6);
    expect(result.points[24].propertyValue).toBeCloseTo(start * 1.02 ** 2, 6);
  });

  it('invests exactly the cash gap when the ETF return is zero', () => {
    const result = simulateHousing(quiet);
    let gap = result.initialCash;
    for (const point of result.points) {
      if (point.month === 0) continue;
      gap += point.buyerCash - point.renterCash;
    }
    expect(
      result.totals.renterEtfContributions - result.totals.buyerEtfContributions,
    ).toBeCloseTo(gap, 4);
    expect(result.finalRenterNet).toBeCloseTo(result.totals.renterEtfContributions, 4);
    expect(result.points[result.points.length - 1].loanBalance).toBeCloseTo(0, 4);
    expect(result.totals.principal).toBeCloseTo(result.loan, 4);
    expect(result.totals.interest).toBeCloseTo(0, 4);
  });

  it('lets a cheap rent and a strong ETF beat buying', () => {
    const result = simulateHousing({
      ...quiet,
      horizonYears: 20,
      coldRentPerSqm: 1,
      mortgageRatePercent: 6,
      initialRepaymentPercent: 1,
      msciReturnPercent: 12,
      appreciationPercent: 0,
    });
    expect(result.finalRenterNet).toBeGreaterThan(result.finalBuyerNet);
  });

  it('lets a costly rent and rising prices beat renting when the ETF stands still', () => {
    const result = simulateHousing({
      ...quiet,
      horizonYears: 20,
      coldRentPerSqm: 40,
      mortgageRatePercent: 1,
      initialRepaymentPercent: 2,
      msciReturnPercent: 0,
      appreciationPercent: 4,
      sellingCostPercent: 0,
    });
    expect(result.finalBuyerNet).toBeGreaterThan(result.finalRenterNet);
  });
});
