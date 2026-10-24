import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASING,
  carValueAtYear,
  plannedBuyoutPrice,
  reviveLeasing,
  simulateLeasing,
  type LeasingInput,
} from './model';

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

describe('reviveLeasing', () => {
  it('reads an older ownership length stored in months', () => {
    const revived = reviveLeasing({ ...DEFAULT_LEASING, ownershipMonths: 36, ownershipYears: undefined });
    expect(revived?.ownershipYears).toBe(3);
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

  it('keeps the original upkeep schedule when the car is not replaced', () => {
    const result = simulateLeasing(DEFAULT_LEASING);
    expect(result.buyerPurchases).toBe(1);
    expect(result.totals.ownerMaintenance).toBe(4680);
    expect(result.totals.leaseMaintenance).toBe(30 * 72);
  });

  it('earns more market return on the lessee’s larger balance, while the buyer’s balance rises by new savings', () => {
    const result = simulateLeasing(DEFAULT_LEASING);
    const first = result.points[0];
    const last = result.points[result.points.length - 1];
    expect(result.lesseeMarketGain).toBeGreaterThan(result.buyerMarketGain);
    expect(last.lesseeEtfNet).toBeGreaterThan(last.buyerEtfNet);
    expect(last.buyerEtfNet - first.buyerEtfNet).toBeGreaterThan(last.lesseeEtfNet - first.lesseeEtfNet);
    expect(first.lesseeMarketGain).toBeCloseTo(0, 6);
    expect(first.buyerMarketGain).toBeCloseTo(0, 6);
  });

  it('pays for the buyer’s next car from the buyer’s ETF and leaves the lessee’s wealth on its monthly path', () => {
    const result = simulateLeasing({
      ...DEFAULT_LEASING,
      ownershipYears: 8,
      horizonYears: 20,
      applyEtfTax: false,
    });
    const jump = result.points.find(
      (point, index) => index > 0 && point.carValue > result.points[index - 1].carValue + 5_000,
    );
    expect(jump).toBeTruthy();
    const previous = result.points[jump!.month - 1];
    expect(Math.abs(jump!.lesseeNet - previous.lesseeNet)).toBeLessThan(1_000);
    expect(result.totals.buyerUnfunded).toBe(0);
    expect(result.buyerPurchases).toBeGreaterThan(1);
    expect(result.points.every((point) => point.buyerNet >= -1 && point.lesseeNet >= -1)).toBe(true);
  });

  it('runs past 40 years and caps only after 80', () => {
    const long = simulateLeasing({ ...DEFAULT_LEASING, horizonYears: 45 });
    expect(long.points[long.points.length - 1].month).toBe(45 * 12);
    expect(long.warnings).toEqual([]);
    const capped = simulateLeasing({ ...DEFAULT_LEASING, horizonYears: 90 });
    expect(capped.points[capped.points.length - 1].month).toBe(80 * 12);
    expect(capped.warnings.some((warning) => warning.includes('80'))).toBe(true);
  });

  it('changes only the lessee when the car is bought at the end of the lease', () => {
    const base = simulateLeasing({ ...DEFAULT_LEASING, horizonYears: 40, ownershipYears: 8 });
    const buy = simulateLeasing({
      ...DEFAULT_LEASING,
      horizonYears: 40,
      ownershipYears: 8,
      buyAfterLease: true,
    });
    expect(buy.points.length).toBe(base.points.length);
    for (let index = 0; index < base.points.length; index += 1) {
      expect(buy.points[index].buyerNet).toBeCloseTo(base.points[index].buyerNet, 4);
      expect(buy.points[index].buyerEtfNet).toBeCloseTo(base.points[index].buyerEtfNet, 4);
      expect(buy.points[index].carValue).toBeCloseTo(base.points[index].carValue, 4);
    }
    expect(buy.finalBuyerNet).toBeCloseTo(base.finalBuyerNet, 4);
    expect(buy.buyoutMonth).toBe(36);
    expect(buy.points[36].lesseeCarEquity).toBeGreaterThan(10_000);
    expect(buy.points[36].lesseeNet).not.toBeCloseTo(base.points[36].lesseeNet, 0);
    expect(buy.points.every((point) => point.buyerNet >= -1 && point.lesseeNet >= -1)).toBe(true);
    expect(buy.totals.buyerUnfunded).toBe(0);
    expect(buy.totals.lesseeUnfunded).toBe(0);
  });

  it('does not buy a new car when the ownership interval is the whole horizon', () => {
    const result = simulateLeasing({ ...quiet, ownershipYears: 6, horizonYears: 6 });
    expect(result.buyerPurchases).toBe(1);
    expect(result.finalCarValue).toBeCloseTo(carValueAtYear(35_000, 6, 0.22, 0.12), 4);
  });

  it('lets the lessee buy the car when the contract ends and then pay owner upkeep', () => {
    const result = simulateLeasing({ ...quiet, buyAfterLease: true });
    const residual = carValueAtYear(35_000, 3, 0.22, 0.12);
    expect(plannedBuyoutPrice({ ...quiet, buyAfterLease: true })).toBeCloseTo(residual, 4);
    expect(result.buyoutMonth).toBe(36);
    expect(result.buyoutPrice).toBeCloseTo(residual, 4);
    expect(result.contracts).toBe(1);
    expect(result.totals.leasePayments).toBeCloseTo(result.monthlyLease * 36, 6);
    expect(result.totals.transferFees).toBe(900);
    expect(result.points[36].lesseeCash).toBeCloseTo(result.monthlyLease + 30 + residual + 180, 4);
    expect(result.points[36].lesseeCarEquity).toBeCloseTo(residual, 4);
    expect(result.points[36].buyerEtfNet - result.points[35].buyerEtfNet).toBeLessThan(1_000);
    expect(result.totals.lesseeEtfWithdrawals + result.totals.lesseeUnfunded).toBeCloseTo(residual + 180, 2);
    expect(result.points[37].lesseeCash).toBe(45 + 3 * 8);
    expect(result.points[37].lesseeCarValue).toBeLessThan(residual);
    expect(result.points[72].lesseeCarValue).toBeCloseTo(result.points[72].carValue, 4);
    expect(result.totals.leasePayments).toBeLessThan(
      simulateLeasing(quiet).totals.leasePayments,
    );
  });

  it('uses an explicit buyout price', () => {
    const result = simulateLeasing({ ...quiet, buyAfterLease: true, buyoutPrice: 12_000, horizonYears: 3 });
    expect(result.buyoutPrice).toBe(12_000);
    expect(result.totals.lesseeBuyout).toBe(12_000);
    expect(result.points[36].lesseeCarEquity).toBeCloseTo(carValueAtYear(35_000, 3, 0.22, 0.12), 4);
  });

  it('saving from zero keeps the same finish as starting with the car money', () => {
    const base = simulateLeasing(DEFAULT_LEASING);
    const saved = simulateLeasing({
      ...DEFAULT_LEASING,
      sameStartingCapital: true,
      monthlySavings: 600,
    });
    expect(saved.points[0].buyerEtfNet).toBe(0);
    expect(saved.points[0].lesseeEtfNet).toBe(0);
    expect(saved.acquisitionMonth).toBeGreaterThan(1);
    const bought = saved.points[saved.acquisitionMonth!];
    expect(bought.carValue).toBeCloseTo(base.points[0].carValue, 4);
    expect(bought.buyerEtfNet).toBeCloseTo(base.points[0].buyerEtfNet, 4);
    expect(bought.lesseeEtfNet).toBeCloseTo(base.points[0].lesseeEtfNet, 4);
    expect(saved.finalBuyerNet).toBeCloseTo(base.finalBuyerNet, 6);
    expect(saved.finalLesseeNet).toBeCloseTo(base.finalLesseeNet, 6);
    expect(saved.points[saved.points.length - 1].month).toBe(
      base.points[base.points.length - 1].month + saved.acquisitionMonth!,
    );
    const before = saved.points[saved.acquisitionMonth! - 1];
    expect(before.carValue).toBe(0);
    expect(before.buyerEtfNet).toBeCloseTo(before.lesseeEtfNet, 4);
  });

  it('with tax and a positive return, keeps the ETFs identical until the buyer spends them', () => {
    const result = simulateLeasing({
      ...DEFAULT_LEASING,
      sameStartingCapital: true,
      monthlySavings: 700,
      horizonYears: 10,
      ownershipYears: 10,
    });
    const month = result.acquisitionMonth ?? 0;
    expect(month).toBeGreaterThan(1);
    const before = result.points[month - 1];
    const at = result.points[month];
    expect(before.buyerEtfNet).toBeCloseTo(before.lesseeEtfNet, 4);
    expect(before.carValue).toBe(0);
    expect(at.carValue).toBeCloseTo(35_000, 4);
    expect(at.buyerEtfNet).toBeLessThan(1_000);
    expect(at.lesseeEtfNet).toBeGreaterThan(30_000);
    expect(result.lesseeMarketGain).toBeGreaterThan(result.buyerMarketGain);
    expect(result.points[result.points.length - 1].lesseeEtfNet).toBeGreaterThan(
      result.points[result.points.length - 1].buyerEtfNet,
    );
  });

  it('buys the leased car from the ETF when both options are on', () => {
    const price = 1_200;
    const result = simulateLeasing({
      ...quiet,
      sameStartingCapital: true,
      buyAfterLease: true,
      buyoutPrice: 500,
      monthlySavings: price,
      purchasePrice: price,
      listPrice: 1_000,
      leasingFactor: 1,
      registrationFee: 0,
      transferFee: 0,
      specialPayment: 0,
      leaseMaintenance: 0,
      ownerMaintenanceBase: 0,
      ownerMaintenanceAgeStep: 0,
      firstYearDropPercent: 22,
      laterDropPercent: 12,
      leaseTermMonths: 6,
      horizonYears: 1,
      ownershipYears: 8,
    });
    expect(result.acquisitionMonth).toBe(1);
    expect(result.buyoutMonth).toBe(1 + 6);
    expect(result.totals.leasePayments).toBeCloseTo(10 * 6, 6);
    expect(result.totals.lesseeBuyout).toBe(500);
    expect(result.points[7].lesseeCarEquity).toBeCloseTo(price * (1 - 0.22 * 0.5), 4);
    expect(result.points[8].lesseeCash).toBe(0);
    expect(result.points[8].lesseeCarValue).toBeLessThan(result.points[7].lesseeCarValue);
    expect(result.warnings).toEqual([]);
  });

  it('warns when the savings never reach the car', () => {
    const result = simulateLeasing({
      ...quiet,
      sameStartingCapital: true,
      monthlySavings: 10,
      horizonYears: 2,
    });
    expect(result.acquisitionMonth).toBeNull();
    expect(result.buyerPurchases).toBe(0);
    expect(result.finalBuyerNet).toBeCloseTo(result.finalLesseeNet, 4);
    expect(result.warnings.some((warning) => warning.includes('never reaches'))).toBe(true);
  });

  it('keeps the financed comparison when the chart starts by saving from zero', () => {
    const financed = simulateLeasing({ ...quiet, financePurchase: true, horizonYears: 1 });
    expect(financed.loan).toBeCloseTo(35_000 * 0.8, 6);
    expect(financed.buyerInitialCash).toBeCloseTo(35_000 * 0.2 + 180, 6);
    expect(financed.totals.loanInterest).toBeGreaterThan(0);
    const saved = simulateLeasing({
      ...quiet,
      financePurchase: true,
      sameStartingCapital: true,
      monthlySavings: 1_000,
      horizonYears: 1,
    });
    expect(saved.loan).toBeCloseTo(financed.loan, 6);
    expect(saved.finalBuyerNet).toBeCloseTo(financed.finalBuyerNet, 4);
    expect(saved.finalLesseeNet).toBeCloseTo(financed.finalLesseeNet, 4);
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
