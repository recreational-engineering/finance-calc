import { EtfAccount, taxSettings } from '../../platform/etf';
import { horizonLabel } from '../../platform/format';
import { amortizeMonth, annuityPayment, monthsUntilPayoff } from '../../platform/loan';
import { effectiveMonthlyRate, finiteOr } from '../../platform/rates';
import { reviveFields } from '../../platform/revive';

export interface LeasingInput {
  horizonYears: number;
  listPrice: number;
  purchasePrice: number;
  leasingFactor: number;
  leaseTermMonths: number;
  specialPayment: number;
  transferFee: number;
  firstYearDropPercent: number;
  laterDropPercent: number;
  ownerMaintenanceBase: number;
  ownerMaintenanceAgeStep: number;
  leaseMaintenance: number;
  registrationFee: number;
  financePurchase: boolean;
  downPaymentPercent: number;
  loanRatePercent: number;
  loanYears: number;
  msciReturnPercent: number;
  applyEtfTax: boolean;
  basiszinsPercent: number;
  allowance: number;
}

/**
 * Illustrative compact car in Germany, not a dealer quote.
 * A leasing factor of 0.95 sits in the 2026 “typical” band described by ADAC
 * (about 0.85–1.2). Depreciation of 22% in year one and 12% a year after that
 * lands a combustion car near a 60% residual after three years, in line with
 * DAT figures for 2026. The lease is Finanzleasing: the lessee pays upkeep,
 * and fuel, insurance, vehicle tax and parking are omitted because both lives
 * drive the same car.
 */
export const DEFAULT_LEASING: LeasingInput = {
  horizonYears: 6,
  listPrice: 38000,
  purchasePrice: 35000,
  leasingFactor: 0.95,
  leaseTermMonths: 36,
  specialPayment: 0,
  transferFee: 900,
  firstYearDropPercent: 22,
  laterDropPercent: 12,
  ownerMaintenanceBase: 45,
  ownerMaintenanceAgeStep: 8,
  leaseMaintenance: 30,
  registrationFee: 180,
  financePurchase: false,
  downPaymentPercent: 20,
  loanRatePercent: 5.9,
  loanYears: 4,
  msciReturnPercent: 7,
  applyEtfTax: true,
  basiszinsPercent: 3.2,
  allowance: 1000,
};

export interface LeasingPoint {
  month: number;
  label: string;
  carValue: number;
  loanBalance: number;
  carEquity: number;
  buyerEtfNet: number;
  lesseeEtfNet: number;
  buyerNet: number;
  lesseeNet: number;
  buyerCash: number;
  lesseeCash: number;
}

export interface LeasingTotals {
  leasePayments: number;
  specialPayments: number;
  transferFees: number;
  leaseMaintenance: number;
  ownerMaintenance: number;
  loanInterest: number;
  loanPrincipal: number;
  registration: number;
  depreciation: number;
  buyerEtfContributions: number;
  lesseeEtfContributions: number;
  buyerExpenditure: number;
  lesseeExpenditure: number;
}

export interface LeasingResult {
  points: LeasingPoint[];
  monthlyLease: number;
  contracts: number;
  loan: number;
  loanPayment: number;
  payoffMonth: number | null;
  startingCash: number;
  buyerInitialCash: number;
  lesseeInitialCash: number;
  finalCarValue: number;
  totals: LeasingTotals;
  finalBuyerNet: number;
  finalLesseeNet: number;
  warnings: string[];
}

export function carValueAtYear(
  purchasePrice: number,
  years: number,
  firstYearDrop: number,
  laterDrop: number,
): number {
  if (!(purchasePrice > 0) || years <= 0) return Math.max(0, purchasePrice);
  const first = Math.min(1, Math.max(0, firstYearDrop));
  const later = Math.min(1, Math.max(0, laterDrop));
  const afterFirst = purchasePrice * (1 - first);
  if (years <= 1) return purchasePrice + (afterFirst - purchasePrice) * years;
  return Math.max(0, afterFirst * Math.pow(1 - later, years - 1));
}

export function reviveLeasing(value: unknown): LeasingInput | null {
  return reviveFields(DEFAULT_LEASING, value);
}

function nonNegative(value: number): number {
  const finite = finiteOr(value, 0);
  return finite < 0 ? 0 : finite;
}

function emptyTotals(): LeasingTotals {
  return {
    leasePayments: 0,
    specialPayments: 0,
    transferFees: 0,
    leaseMaintenance: 0,
    ownerMaintenance: 0,
    loanInterest: 0,
    loanPrincipal: 0,
    registration: 0,
    depreciation: 0,
    buyerEtfContributions: 0,
    lesseeEtfContributions: 0,
    buyerExpenditure: 0,
    lesseeExpenditure: 0,
  };
}

/**
 * Cash purchase is the default: the lessee invests the price the buyer pays.
 * Financing can be switched on; then only the down payment is free capital,
 * and the loan instalment becomes part of the buyer's monthly cash.
 * A new lease starts every contract term. A horizon that is not a whole
 * number of contracts keeps paying the lease and does not add an early-return penalty.
 */
export function simulateLeasing(input: LeasingInput): LeasingResult {
  const warnings: string[] = [];
  const years = finiteOr(input.horizonYears, 0);
  if (!(years > 0)) return blank('Set a horizon of at least one year.');
  const horizonYears = Math.min(years, 25);
  if (years > 25) warnings.push('The horizon is capped at 25 years.');
  const months = Math.round(horizonYears * 12);

  const listPrice = nonNegative(input.listPrice);
  const purchasePrice = nonNegative(input.purchasePrice);
  if (!(purchasePrice > 0) || !(listPrice > 0)) {
    warnings.push('Set both the list price and the price you would actually pay.');
  }
  let term = Math.round(finiteOr(input.leaseTermMonths, 36));
  if (term < 1) {
    term = 1;
    warnings.push('The lease term must be at least one month.');
  }
  if (months % term !== 0) {
    warnings.push(
      'The horizon is not a whole number of lease contracts. The last contract is assumed to stop at the horizon, with no extra early-return fee.',
    );
  }

  const factor = finiteOr(input.leasingFactor, 0);
  const monthlyLease = listPrice * (factor / 100);
  const special = nonNegative(input.specialPayment);
  const transfer = nonNegative(input.transferFee);
  const registration = nonNegative(input.registrationFee);
  const contracts = Math.max(1, Math.ceil(months / term));

  let downPercent = finiteOr(input.downPaymentPercent, 0);
  if (input.financePurchase && (downPercent < 0 || downPercent > 100)) {
    warnings.push('The down payment is limited to 0–100% of the purchase price.');
    downPercent = Math.min(100, Math.max(0, downPercent));
  }
  const loan = input.financePurchase ? purchasePrice * (1 - downPercent / 100) : 0;
  const loanYears = Math.max(1, finiteOr(input.loanYears, 1));
  const loanMonths = Math.round(loanYears * 12);
  const loanRate = finiteOr(input.loanRatePercent, 0);
  const loanPayment = input.financePurchase ? annuityPayment(loan, loanRate, loanMonths) : 0;
  const payoffMonth = input.financePurchase ? monthsUntilPayoff(loan, loanRate, loanPayment) : 0;

  const buyerInitialCash =
    (input.financePurchase ? purchasePrice - loan : purchasePrice) + registration;
  const lesseeInitialCash = special + transfer;
  const startingCash = Math.max(buyerInitialCash, lesseeInitialCash);

  const firstDrop = nonNegative(input.firstYearDropPercent) / 100;
  const laterDrop = nonNegative(input.laterDropPercent) / 100;
  const msciMonthly = effectiveMonthlyRate(finiteOr(input.msciReturnPercent, 0));
  const tax = taxSettings({
    enabled: input.applyEtfTax,
    basiszinsPercent: finiteOr(input.basiszinsPercent, 0),
    allowance: nonNegative(input.allowance),
  });

  const buyerEtf = new EtfAccount(tax);
  const lesseeEtf = new EtfAccount(tax);
  buyerEtf.deposit(startingCash - buyerInitialCash, false);
  lesseeEtf.deposit(startingCash - lesseeInitialCash, false);
  buyerEtf.yearStartValue = buyerEtf.value;
  lesseeEtf.yearStartValue = lesseeEtf.value;

  const totals = emptyTotals();
  totals.registration = registration;
  totals.specialPayments = special;
  totals.transferFees = transfer;
  totals.buyerEtfContributions = startingCash - buyerInitialCash;
  totals.lesseeEtfContributions = startingCash - lesseeInitialCash;

  let loanBalance = loan;
  const valueAt = (month: number) => carValueAtYear(purchasePrice, month / 12, firstDrop, laterDrop);

  const point = (
    month: number,
    buyerCash: number,
    lesseeCash: number,
  ): LeasingPoint => {
    const carValue = valueAt(month);
    const carEquity = carValue - loanBalance;
    const buyerEtfNet = buyerEtf.afterTaxValue();
    const lesseeEtfNet = lesseeEtf.afterTaxValue();
    return {
      month,
      label: horizonLabel(month),
      carValue,
      loanBalance,
      carEquity,
      buyerEtfNet,
      lesseeEtfNet,
      buyerNet: carEquity + buyerEtfNet,
      lesseeNet: lesseeEtfNet,
      buyerCash,
      lesseeCash,
    };
  };

  const points: LeasingPoint[] = [point(0, buyerInitialCash, lesseeInitialCash)];

  for (let month = 1; month <= months; month += 1) {
    const ageYears = Math.floor((month - 1) / 12);
    const ownerMaintenance =
      nonNegative(input.ownerMaintenanceBase) +
      ageYears * nonNegative(input.ownerMaintenanceAgeStep);
    const leaseMaintenance = nonNegative(input.leaseMaintenance);
    const monthInCycle = (month - 1) % term;
    const cycleIndex = Math.floor((month - 1) / term);
    const renewal = monthInCycle === 0 && cycleIndex > 0;
    const renewalSpecial = renewal ? special : 0;
    const renewalTransfer = renewal ? transfer : 0;

    const step = amortizeMonth(loanBalance, loanRate, loanBalance > 0 ? loanPayment : 0);
    loanBalance = step.balance;

    const buyerCash = step.payment + ownerMaintenance;
    const lesseeCash = monthlyLease + leaseMaintenance + renewalSpecial + renewalTransfer;

    totals.ownerMaintenance += ownerMaintenance;
    totals.leaseMaintenance += leaseMaintenance;
    totals.leasePayments += monthlyLease;
    totals.specialPayments += renewalSpecial;
    totals.transferFees += renewalTransfer;
    totals.loanInterest += step.interest;
    totals.loanPrincipal += step.principal;

    buyerEtf.accrueMonth(msciMonthly);
    lesseeEtf.accrueMonth(msciMonthly);
    const gap = buyerCash - lesseeCash;
    if (gap > 0) {
      lesseeEtf.deposit(gap);
      totals.lesseeEtfContributions += gap;
    } else if (gap < 0) {
      buyerEtf.deposit(-gap);
      totals.buyerEtfContributions += -gap;
    }
    if (month % 12 === 0) {
      buyerEtf.endYear();
      lesseeEtf.endYear();
    }
    points.push(point(month, buyerCash, lesseeCash));
    if (month % 12 === 0) {
      buyerEtf.rollYear();
      lesseeEtf.rollYear();
    }
  }

  const final = points[points.length - 1];
  totals.depreciation = Math.max(0, purchasePrice - final.carValue);
  totals.buyerExpenditure =
    totals.depreciation + totals.loanInterest + totals.ownerMaintenance + totals.registration;
  totals.lesseeExpenditure =
    totals.leasePayments + totals.specialPayments + totals.transferFees + totals.leaseMaintenance;

  return {
    points,
    monthlyLease,
    contracts,
    loan,
    loanPayment,
    payoffMonth,
    startingCash,
    buyerInitialCash,
    lesseeInitialCash,
    finalCarValue: final.carValue,
    totals,
    finalBuyerNet: final.buyerNet,
    finalLesseeNet: final.lesseeNet,
    warnings,
  };
}

function blank(warning: string): LeasingResult {
  return {
    points: [],
    monthlyLease: 0,
    contracts: 0,
    loan: 0,
    loanPayment: 0,
    payoffMonth: null,
    startingCash: 0,
    buyerInitialCash: 0,
    lesseeInitialCash: 0,
    finalCarValue: 0,
    totals: emptyTotals(),
    finalBuyerNet: 0,
    finalLesseeNet: 0,
    warnings: [warning],
  };
}
