import { EtfAccount, taxSettings } from '../../platform/etf';
import { horizonLabel } from '../../platform/format';
import {
  amortizeMonth,
  germanMortgagePayment,
  monthsUntilPayoff,
} from '../../platform/loan';
import { effectiveMonthlyRate, finiteOr } from '../../platform/rates';
import { reviveFields } from '../../platform/revive';

export interface HousingInput {
  horizonYears: number;
  areaSqm: number;
  pricePerSqm: number;
  coldRentPerSqm: number;
  rentGrowthPercent: number;
  appreciationPercent: number;
  downPaymentPercent: number;
  transferTaxPercent: number;
  notaryPercent: number;
  brokerPercent: number;
  mortgageRatePercent: number;
  initialRepaymentPercent: number;
  maintenancePerSqmMonth: number;
  adminMonthly: number;
  grundsteuerMonthly: number;
  insuranceMonthly: number;
  ownerCostInflationPercent: number;
  sellingCostPercent: number;
  assumeSale: boolean;
  msciReturnPercent: number;
  applyEtfTax: boolean;
  basiszinsPercent: number;
  allowance: number;
}

/**
 * Munich planning defaults, October 2026. Every field is editable in the tool.
 *
 * Existing-apartment asking prices of about €8,800/m² and unfurnished new-lease
 * cold rents of about €22.90/m² are the H1 2026 ImmoScout24 averages published
 * by the City of Munich (Wohnungsmarktbarometer). 75 m² is a typical flat;
 * listed stock averages closer to 79 m².
 *
 * Bavaria still charges 3.5% transfer tax. Notary and land register are about
 * 2%. Where a broker is shared, the buyer's half is usually 3.57% incl. VAT.
 * Ten-year fixed mortgage quotes in Munich were about 4.35–4.50% in October 2026.
 * The model keeps that nominal rate for the whole remaining term.
 *
 * Maintenance of €2/m² per month is a reserve for upkeep and special assessments,
 * not the full Hausgeld. Heating and other recoverable operating costs are left
 * out because a tenant pays them as Nebenkosten too.
 *
 * Long-run appreciation of 1.5% is deliberately calmer than the pre-2022 boom.
 * Rent growth of 2.5% is near recent Mietspiegel drift and under Munich's
 * Kappungsgrenze. The MSCI figure is a planning assumption, not a forecast.
 * Basiszins 3.20% is the BMF rate for 2 January 2026.
 */
export const DEFAULT_HOUSING: HousingInput = {
  horizonYears: 30,
  areaSqm: 75,
  pricePerSqm: 8800,
  coldRentPerSqm: 22.9,
  rentGrowthPercent: 2.5,
  appreciationPercent: 1.5,
  downPaymentPercent: 20,
  transferTaxPercent: 3.5,
  notaryPercent: 2,
  brokerPercent: 3.57,
  mortgageRatePercent: 4.5,
  initialRepaymentPercent: 2,
  maintenancePerSqmMonth: 2,
  adminMonthly: 30,
  grundsteuerMonthly: 40,
  insuranceMonthly: 25,
  ownerCostInflationPercent: 2,
  sellingCostPercent: 3.57,
  assumeSale: true,
  msciReturnPercent: 7,
  applyEtfTax: true,
  basiszinsPercent: 3.2,
  allowance: 1000,
};

export interface HousingPoint {
  month: number;
  label: string;
  propertyValue: number;
  loanBalance: number;
  equityNet: number;
  buyerEtfNet: number;
  renterEtfNet: number;
  buyerNet: number;
  renterNet: number;
  buyerCash: number;
  renterCash: number;
}

export interface HousingTotals {
  rent: number;
  interest: number;
  principal: number;
  maintenance: number;
  admin: number;
  grundsteuer: number;
  insurance: number;
  buyerEtfContributions: number;
  renterEtfContributions: number;
  buyerEtfTaxPaid: number;
  renterEtfTaxPaid: number;
  sellingCosts: number;
  buyerExpenditure: number;
  renterExpenditure: number;
}

export interface HousingResult {
  points: HousingPoint[];
  purchasePrice: number;
  closingCosts: number;
  downPayment: number;
  loan: number;
  monthlyMortgage: number;
  startingRent: number;
  initialCash: number;
  payoffMonth: number | null;
  totals: HousingTotals;
  finalBuyerNet: number;
  finalRenterNet: number;
  warnings: string[];
}

function emptyTotals(): HousingTotals {
  return {
    rent: 0,
    interest: 0,
    principal: 0,
    maintenance: 0,
    admin: 0,
    grundsteuer: 0,
    insurance: 0,
    buyerEtfContributions: 0,
    renterEtfContributions: 0,
    buyerEtfTaxPaid: 0,
    renterEtfTaxPaid: 0,
    sellingCosts: 0,
    buyerExpenditure: 0,
    renterExpenditure: 0,
  };
}

export function reviveHousing(value: unknown): HousingInput | null {
  return reviveFields(DEFAULT_HOUSING, value);
}

function nonNegative(value: number, fallback = 0): number {
  const finite = finiteOr(value, fallback);
  return finite < 0 ? 0 : finite;
}

/**
 * Both lives spend the same cash. The buyer converts the down payment and
 * purchase costs into a flat. The renter invests that sum, and thereafter
 * invests whatever the buyer has to pay above the rent. When the rent is
 * higher, the buyer invests the difference. Wealth is marked as if each
 * person stopped today: the flat net of selling costs, the ETF net of
 * German exit tax. Owner-occupied gains are treated as tax-free under §23 EStG.
 */
export function simulateHousing(input: HousingInput): HousingResult {
  const warnings: string[] = [];
  const years = finiteOr(input.horizonYears, 0);
  if (!(years > 0)) {
    return blank('Set a horizon of at least one year.');
  }
  const horizonYears = Math.min(years, 50);
  if (years > 50) warnings.push('The horizon is capped at 50 years.');
  const months = Math.round(horizonYears * 12);

  const area = nonNegative(input.areaSqm);
  const purchasePrice = area * nonNegative(input.pricePerSqm);
  if (!(purchasePrice > 0)) warnings.push('Set an area and a purchase price.');

  const closingRate =
    (nonNegative(input.transferTaxPercent) +
      nonNegative(input.notaryPercent) +
      nonNegative(input.brokerPercent)) /
    100;
  const closingCosts = purchasePrice * closingRate;
  let downPercent = finiteOr(input.downPaymentPercent, 0);
  if (downPercent < 0 || downPercent > 100) {
    warnings.push('The down payment is limited to 0–100% of the purchase price.');
    downPercent = Math.min(100, Math.max(0, downPercent));
  }
  const downPayment = purchasePrice * (downPercent / 100);
  const loan = Math.max(0, purchasePrice - downPayment);
  const initialCash = downPayment + closingCosts;
  const mortgageRate = finiteOr(input.mortgageRatePercent, 0);
  const repayment = finiteOr(input.initialRepaymentPercent, 0);
  if (repayment < 0) warnings.push('Initial repayment is below zero, so the loan is not amortizing.');
  const monthlyMortgage = germanMortgagePayment(loan, mortgageRate, Math.max(0, repayment));
  const payoffMonth = monthsUntilPayoff(loan, mortgageRate, monthlyMortgage);
  if (loan > 0 && payoffMonth === null) {
    warnings.push('This instalment never repays the loan. Raise the initial repayment.');
  }

  const appreciation = effectiveMonthlyRate(finiteOr(input.appreciationPercent, 0));
  const msciMonthly = effectiveMonthlyRate(finiteOr(input.msciReturnPercent, 0));
  const tax = taxSettings({
    enabled: input.applyEtfTax,
    basiszinsPercent: finiteOr(input.basiszinsPercent, 0),
    allowance: nonNegative(input.allowance),
  });

  let rent = area * nonNegative(input.coldRentPerSqm);
  const startingRent = rent;
  let maintenanceRate = nonNegative(input.maintenancePerSqmMonth);
  let admin = nonNegative(input.adminMonthly);
  let grundsteuer = nonNegative(input.grundsteuerMonthly);
  let insurance = nonNegative(input.insuranceMonthly);
  let propertyValue = purchasePrice;
  let loanBalance = loan;

  const buyerEtf = new EtfAccount(tax);
  const renterEtf = new EtfAccount(tax);
  renterEtf.deposit(initialCash, false);
  renterEtf.yearStartValue = renterEtf.value;
  buyerEtf.yearStartValue = 0;

  const totals = emptyTotals();
  totals.renterEtfContributions = initialCash;
  const sellingRate = input.assumeSale ? nonNegative(input.sellingCostPercent) / 100 : 0;

  const equityNet = () => {
    const haircut = propertyValue * sellingRate;
    return propertyValue - loanBalance - haircut;
  };

  const points: HousingPoint[] = [
    {
      month: 0,
      label: horizonLabel(0),
      propertyValue,
      loanBalance,
      equityNet: equityNet(),
      buyerEtfNet: 0,
      renterEtfNet: renterEtf.afterTaxValue(),
      buyerNet: equityNet(),
      renterNet: renterEtf.afterTaxValue(),
      buyerCash: initialCash,
      renterCash: 0,
    },
  ];

  for (let month = 1; month <= months; month += 1) {
    if ((month - 1) % 12 === 0 && month > 1) {
      rent *= 1 + finiteOr(input.rentGrowthPercent, 0) / 100;
      const inflation = 1 + finiteOr(input.ownerCostInflationPercent, 0) / 100;
      maintenanceRate *= inflation;
      admin *= inflation;
      grundsteuer *= inflation;
      insurance *= inflation;
    }

    propertyValue *= 1 + appreciation;

    const step = amortizeMonth(loanBalance, mortgageRate, monthlyMortgage);
    loanBalance = step.balance;
    const maintenance = maintenanceRate * area;
    const carrying = maintenance + admin + grundsteuer + insurance;
    const buyerCash = step.payment + carrying;
    const renterCash = rent;

    totals.interest += step.interest;
    totals.principal += step.principal;
    totals.maintenance += maintenance;
    totals.admin += admin;
    totals.grundsteuer += grundsteuer;
    totals.insurance += insurance;
    totals.rent += rent;

    buyerEtf.accrueMonth(msciMonthly);
    renterEtf.accrueMonth(msciMonthly);
    const gap = buyerCash - renterCash;
    if (gap > 0) {
      renterEtf.deposit(gap);
      totals.renterEtfContributions += gap;
    } else if (gap < 0) {
      buyerEtf.deposit(-gap);
      totals.buyerEtfContributions += -gap;
    }
    if (month % 12 === 0) {
      buyerEtf.endYear();
      renterEtf.endYear();
    }

    const buyerEtfNet = buyerEtf.afterTaxValue();
    const renterEtfNet = renterEtf.afterTaxValue();
    const equity = equityNet();
    points.push({
      month,
      label: horizonLabel(month),
      propertyValue,
      loanBalance,
      equityNet: equity,
      buyerEtfNet,
      renterEtfNet,
      buyerNet: equity + buyerEtfNet,
      renterNet: renterEtfNet,
      buyerCash,
      renterCash,
    });

    if (month % 12 === 0) {
      buyerEtf.rollYear();
      renterEtf.rollYear();
    }
  }

  const final = points[points.length - 1];
  totals.sellingCosts = final.propertyValue * sellingRate;
  totals.buyerEtfTaxPaid = buyerEtf.taxesPaid;
  totals.renterEtfTaxPaid = renterEtf.taxesPaid;
  totals.buyerExpenditure =
    closingCosts +
    totals.interest +
    totals.maintenance +
    totals.admin +
    totals.grundsteuer +
    totals.insurance +
    totals.sellingCosts;
  totals.renterExpenditure = totals.rent;

  return {
    points,
    purchasePrice,
    closingCosts,
    downPayment,
    loan,
    monthlyMortgage,
    startingRent,
    initialCash,
    payoffMonth,
    totals,
    finalBuyerNet: final.buyerNet,
    finalRenterNet: final.renterNet,
    warnings,
  };
}

function blank(warning: string): HousingResult {
  return {
    points: [],
    purchasePrice: 0,
    closingCosts: 0,
    downPayment: 0,
    loan: 0,
    monthlyMortgage: 0,
    startingRent: 0,
    initialCash: 0,
    payoffMonth: null,
    totals: emptyTotals(),
    finalBuyerNet: 0,
    finalRenterNet: 0,
    warnings: [warning],
  };
}
