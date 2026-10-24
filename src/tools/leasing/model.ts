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
  /** Buyer sells the car and buys another after this many years. */
  ownershipYears: number;
  /** Lessee buys the car when the first contract ends, instead of renewing. */
  buyAfterLease: boolean;
  /** Euro. 0 uses the depreciated value at the end of the contract. */
  buyoutPrice: number;
  /**
   * Both start at 0 € and save the same amount until the ETF can buy the car.
   * The buyer then spends the ETF. The lessee keeps it and leases.
   */
  sameStartingCapital: boolean;
  /** Euro per month available for the car and the ETF, before lease or upkeep. */
  monthlySavings: number;
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
  ownershipYears: 8,
  buyAfterLease: false,
  buyoutPrice: 0,
  sameStartingCapital: false,
  monthlySavings: 600,
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
  lesseeCarValue: number;
  lesseeCarEquity: number;
  buyerEtfNet: number;
  lesseeEtfNet: number;
  buyerNet: number;
  lesseeNet: number;
  buyerCash: number;
  lesseeCash: number;
  /** After-tax ETF value, plus cash already taken out, minus cash paid in. */
  buyerMarketGain: number;
  lesseeMarketGain: number;
}

export interface LeasingTotals {
  leasePayments: number;
  specialPayments: number;
  transferFees: number;
  leaseMaintenance: number;
  ownerMaintenance: number;
  lesseeOwnerMaintenance: number;
  loanInterest: number;
  loanPrincipal: number;
  registration: number;
  lesseeRegistration: number;
  depreciation: number;
  lesseeDepreciation: number;
  lesseeBuyout: number;
  buyerSaleProceeds: number;
  lesseeSaleProceeds: number;
  buyerEtfContributions: number;
  lesseeEtfContributions: number;
  buyerEtfWithdrawals: number;
  lesseeEtfWithdrawals: number;
  /** Car money that was not in the ETF. It reduces net worth and is not given to the other life. */
  buyerUnfunded: number;
  lesseeUnfunded: number;
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
  buyerPurchases: number;
  lesseePurchases: number;
  /** Month the saved ETF first buys the car. Null when saving starts from cash already in hand, or the price is never reached. */
  acquisitionMonth: number | null;
  /** Month the lessee actually buys the car. Null when that option is off or the contract outlasts the horizon. */
  buyoutMonth: number | null;
  buyoutPrice: number | null;
  buyerMarketGain: number;
  lesseeMarketGain: number;
  ownershipMonths: number;
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
  const revived = reviveFields(DEFAULT_LEASING, value);
  if (!revived || !value || typeof value !== 'object') return revived;
  const raw = value as Record<string, unknown>;
  const hasYears = typeof raw.ownershipYears === 'number' && Number.isFinite(raw.ownershipYears);
  if (!hasYears && typeof raw.ownershipMonths === 'number' && Number.isFinite(raw.ownershipMonths) && raw.ownershipMonths > 0) {
    revived.ownershipYears = raw.ownershipMonths / 12;
  }
  return revived;
}

function nonNegative(value: number): number {
  const finite = finiteOr(value, 0);
  return finite < 0 ? 0 : finite;
}

/** Price paid to keep the car when the contract ends. An explicit price wins; otherwise the depreciated value. */
export function plannedBuyoutPrice(input: LeasingInput): number {
  const explicit = nonNegative(input.buyoutPrice);
  if (explicit > 0) return explicit;
  const term = Math.max(1, Math.round(finiteOr(input.leaseTermMonths, 36)));
  return carValueAtYear(
    nonNegative(input.purchasePrice),
    term / 12,
    nonNegative(input.firstYearDropPercent) / 100,
    nonNegative(input.laterDropPercent) / 100,
  );
}

function emptyTotals(): LeasingTotals {
  return {
    leasePayments: 0,
    specialPayments: 0,
    transferFees: 0,
    leaseMaintenance: 0,
    ownerMaintenance: 0,
    lesseeOwnerMaintenance: 0,
    loanInterest: 0,
    loanPrincipal: 0,
    registration: 0,
    lesseeRegistration: 0,
    depreciation: 0,
    lesseeDepreciation: 0,
    lesseeBuyout: 0,
    buyerSaleProceeds: 0,
    lesseeSaleProceeds: 0,
    buyerEtfContributions: 0,
    lesseeEtfContributions: 0,
    buyerEtfWithdrawals: 0,
    lesseeEtfWithdrawals: 0,
    buyerUnfunded: 0,
    lesseeUnfunded: 0,
    buyerExpenditure: 0,
    lesseeExpenditure: 0,
  };
}

function marketGain(afterTax: number, deposited: number, withdrawn: number): number {
  return afterTax + withdrawn - deposited;
}

/**
 * Cash purchase is the default: the lessee invests the price the buyer pays.
 * Financing can be switched on; then only the down payment is free capital,
 * and the loan instalment becomes part of the buyer's monthly cash.
 * A new lease starts every contract term unless the lessee buys the car at
 * the end of the first one. The buyer replaces the car on a separate interval.
 * A horizon that is not a whole number of contracts keeps paying the lease and
 * does not add an early-return penalty.
 *
 * Same-capital saving is the other opening. Both start at 0 € and pay the
 * same amount into the ETF. The month the ETF can cover the car, the buyer
 * sells shares and buys it. The lessee keeps the shares, starts the lease,
 * and from then on saves only what the lease does not take. That finish
 * differs from the default because the saving years are inside the horizon
 * and only the buyer spends the accumulated ETF.
 *
 * A later car purchase — the buyer’s replacement, or the lessee’s buyout —
 * is paid from that person’s ETF. It is not invested by the other life.
 * Only the monthly lease, upkeep, and contract fees are shared that way.
 */
export const LEASING_HORIZON_CAP = 80;

export function simulateLeasing(input: LeasingInput): LeasingResult {
  if (input.sameStartingCapital) return attachSavingPrelude(input);
  return simulateOwnedFromTheStart(input);
}

/**
 * Years of saving are drawn in front of the same comparison. The finish matches
 * the horizon with this option off.
 */
function attachSavingPrelude(input: LeasingInput): LeasingResult {
  const core = simulateOwnedFromTheStart({ ...input, sameStartingCapital: false });
  const monthlySavings = nonNegative(input.monthlySavings);
  if (!(monthlySavings > 0)) {
    return {
      ...core,
      warnings: ['Set a monthly saving above zero. The comparison itself is unchanged.', ...core.warnings],
    };
  }
  const target = core.startingCash;
  if (!(target > 0)) return core;

  const msciMonthly = effectiveMonthlyRate(finiteOr(input.msciReturnPercent, 0));
  const tax = taxSettings({
    enabled: input.applyEtfTax,
    basiszinsPercent: finiteOr(input.basiszinsPercent, 0),
    allowance: nonNegative(input.allowance),
  });
  const buyer = new EtfAccount(tax);
  const lessee = new EtfAccount(tax);
  buyer.yearStartValue = 0;
  lessee.yearStartValue = 0;
  const blankPoint = (month: number, buyerEtfNet: number, lesseeEtfNet: number): LeasingPoint => ({
    month,
    label: horizonLabel(month),
    carValue: 0,
    loanBalance: 0,
    carEquity: 0,
    lesseeCarValue: 0,
    lesseeCarEquity: 0,
    buyerEtfNet,
    lesseeEtfNet,
    buyerNet: buyerEtfNet,
    lesseeNet: lesseeEtfNet,
    buyerCash: 0,
    lesseeCash: 0,
    buyerMarketGain: buyerEtfNet - month * monthlySavings,
    lesseeMarketGain: lesseeEtfNet - month * monthlySavings,
  });
  const prelude: LeasingPoint[] = [blankPoint(0, 0, 0)];
  let month = 0;
  let reached = buyer.afterTaxValue() + monthlySavings + 0.01 >= target;
  while (!reached && month < 12 * 40) {
    month += 1;
    buyer.accrueMonth(msciMonthly);
    lessee.accrueMonth(msciMonthly);
    buyer.deposit(monthlySavings);
    lessee.deposit(monthlySavings);
    if (month % 12 === 0) {
      buyer.endYear();
      lessee.endYear();
    }
    prelude.push(blankPoint(month, buyer.afterTaxValue(), lessee.afterTaxValue()));
    if (month % 12 === 0) {
      buyer.rollYear();
      lessee.rollYear();
    }
    reached = buyer.afterTaxValue() + monthlySavings + 0.01 >= target;
  }
  if (!reached) {
    const last = prelude[prelude.length - 1];
    return {
      ...core,
      points: prelude,
      acquisitionMonth: null,
      buyoutMonth: null,
      buyerPurchases: 0,
      lesseePurchases: 0,
      contracts: 0,
      loan: 0,
      loanPayment: 0,
      finalBuyerNet: last.buyerNet,
      finalLesseeNet: last.lesseeNet,
      finalCarValue: 0,
      warnings: [
        'The monthly saving never reaches the car money within 40 years, so the comparison does not start.',
      ],
    };
  }
  const shift = month + 1;
  const points = [
    ...prelude,
    ...core.points.map((point) => ({
      ...point,
      month: point.month + shift,
      label: horizonLabel(point.month + shift),
    })),
  ];
  return {
    ...core,
    points,
    acquisitionMonth: shift,
    buyoutMonth: core.buyoutMonth === null ? null : core.buyoutMonth + shift,
  };
}

function simulateOwnedFromTheStart(input: LeasingInput): LeasingResult {
  const warnings: string[] = [];
  const years = finiteOr(input.horizonYears, 0);
  if (!(years > 0)) return blank('Set a horizon of at least one year.');
  const horizonYears = Math.min(years, LEASING_HORIZON_CAP);
  if (years > LEASING_HORIZON_CAP) {
    warnings.push(`The horizon is capped at ${LEASING_HORIZON_CAP} years.`);
  }
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
  let ownershipYears = finiteOr(input.ownershipYears, 8);
  if (!(ownershipYears > 0)) {
    ownershipYears = 8;
    warnings.push('Set how many years the buyer keeps a car.');
  }
  const ownershipMonths = Math.max(1, Math.round(ownershipYears * 12));

  const sameCapital = input.sameStartingCapital === true;
  const buyAfterLease = input.buyAfterLease === true;
  const monthlySavings = nonNegative(input.monthlySavings);
  if (sameCapital && !(monthlySavings > 0)) {
    warnings.push('Set a monthly saving above zero to reach the car price.');
  }
  if (sameCapital && input.financePurchase) {
    warnings.push('Same-capital saving buys the car with the ETF, so the loan is not used.');
  }
  if (buyAfterLease && ownershipMonths <= term) {
    warnings.push(
      'The buyer replaces the car sooner than the lease ends, so a car bought at the end of the lease is replaced the next month.',
    );
  }

  const factor = finiteOr(input.leasingFactor, 0);
  const monthlyLease = listPrice * (factor / 100);
  const special = nonNegative(input.specialPayment);
  const transfer = nonNegative(input.transferFee);
  const registration = nonNegative(input.registrationFee);
  const buyoutPrice = plannedBuyoutPrice({ ...input, leaseTermMonths: term });

  let downPercent = finiteOr(input.downPaymentPercent, 0);
  const useLoan = input.financePurchase === true && !sameCapital;
  if (useLoan && (downPercent < 0 || downPercent > 100)) {
    warnings.push('The down payment is limited to 0–100% of the purchase price.');
    downPercent = Math.min(100, Math.max(0, downPercent));
  }
  const loan = useLoan ? purchasePrice * (1 - downPercent / 100) : 0;
  const loanYears = Math.max(1, finiteOr(input.loanYears, 1));
  const loanMonths = Math.round(loanYears * 12);
  const loanRate = finiteOr(input.loanRatePercent, 0);
  let loanPayment = useLoan ? annuityPayment(loan, loanRate, loanMonths) : 0;
  let payoffMonth: number | null = useLoan ? monthsUntilPayoff(loan, loanRate, loanPayment) : 0;

  const buyerInitialCash = sameCapital
    ? 0
    : (useLoan ? purchasePrice - loan : purchasePrice) + registration;
  const lesseeInitialCash = sameCapital ? 0 : special + transfer;
  const startingCash = Math.max(buyerInitialCash, lesseeInitialCash);
  const cashNeeded = purchasePrice + registration;

  const firstDrop = nonNegative(input.firstYearDropPercent) / 100;
  const laterDrop = nonNegative(input.laterDropPercent) / 100;
  const msciMonthly = effectiveMonthlyRate(finiteOr(input.msciReturnPercent, 0));
  const tax = taxSettings({
    enabled: input.applyEtfTax,
    basiszinsPercent: finiteOr(input.basiszinsPercent, 0),
    allowance: nonNegative(input.allowance),
  });

  const valueOf = (ageMonths: number) =>
    carValueAtYear(purchasePrice, ageMonths / 12, firstDrop, laterDrop);

  const ownerUpkeep = (ageMonths: number) => {
    const ageYears = Math.floor(Math.max(0, ageMonths) / 12);
    return (
      nonNegative(input.ownerMaintenanceBase) +
      ageYears * nonNegative(input.ownerMaintenanceAgeStep)
    );
  };

  const buyerEtf = new EtfAccount(tax);
  const lesseeEtf = new EtfAccount(tax);
  const totals = emptyTotals();

  if (!sameCapital) {
    buyerEtf.deposit(startingCash - buyerInitialCash, false);
    lesseeEtf.deposit(startingCash - lesseeInitialCash, false);
    totals.registration = registration;
    totals.specialPayments = special;
    totals.transferFees = transfer;
    totals.buyerEtfContributions = startingCash - buyerInitialCash;
    totals.lesseeEtfContributions = startingCash - lesseeInitialCash;
  }
  buyerEtf.yearStartValue = buyerEtf.value;
  lesseeEtf.yearStartValue = lesseeEtf.value;

  let loanBalance = loan;
  let buyerOwns = !sameCapital && purchasePrice > 0;
  let buyerAge = 0;
  let buyerBasis = buyerOwns ? purchasePrice : 0;
  let buyerPurchases = buyerOwns ? 1 : 0;
  let buyerJustPurchased = false;
  let lesseeOwns = false;
  let lesseeAge = 0;
  let lesseeBasis = 0;
  let lesseePurchases = 0;
  let leaseOpen = !sameCapital;
  let leaseStartMonth: number | null = sameCapital ? null : 1;
  let contracts = sameCapital ? 0 : 1;
  let acquired = !sameCapital;
  let acquisitionMonth: number | null = null;
  let buyoutMonth: number | null = null;
  let buyerShortfall = false;
  let lesseeShortfall = false;
  let buyerUnfunded = 0;
  let lesseeUnfunded = 0;

  const replaceBuyer = (month: number): number => {
    const sale = valueOf(buyerAge);
    const payoff = loanBalance;
    totals.buyerSaleProceeds += sale;
    totals.depreciation += buyerBasis - sale;
    totals.loanPrincipal += payoff;
    loanBalance = 0;
    const newLoan = useLoan ? purchasePrice * (1 - downPercent / 100) : 0;
    const cashDown = purchasePrice - newLoan;
    loanBalance = newLoan;
    loanPayment = newLoan > 0 ? annuityPayment(newLoan, loanRate, loanMonths) : 0;
    if (newLoan > 0) {
      const duration = monthsUntilPayoff(newLoan, loanRate, loanPayment);
      payoffMonth = duration === null ? null : month + duration - 1;
    } else if (payoff > 0) {
      payoffMonth = month;
    }
    totals.registration += registration;
    buyerBasis = purchasePrice;
    buyerPurchases += 1;
    buyerAge = 0;
    return cashDown + registration - (sale - payoff);
  };

  const replaceLessee = (): number => {
    const sale = valueOf(lesseeAge);
    totals.lesseeSaleProceeds += sale;
    totals.lesseeDepreciation += lesseeBasis - sale;
    totals.lesseeRegistration += registration;
    lesseeBasis = purchasePrice;
    lesseePurchases += 1;
    lesseeAge = 0;
    return purchasePrice + registration - sale;
  };

  const quoteBuyerReplacement = () => {
    const sale = valueOf(buyerAge);
    const payoff = loanBalance;
    const newLoan = useLoan ? purchasePrice * (1 - downPercent / 100) : 0;
    return purchasePrice - newLoan + registration - (sale - payoff);
  };

  const quoteLesseeReplacement = () => purchasePrice + registration - valueOf(lesseeAge);

  /** The lease a person would keep signing. Buying the car does not change this reference. */
  const continuingLeaseRunning = (month: number) => {
    const elapsed = month - 1;
    const renewal = elapsed > 0 && elapsed % term === 0;
    let amount = monthlyLease + nonNegative(input.leaseMaintenance);
    if (renewal) amount += special + transfer;
    return { amount, renewal };
  };

  const chargeBuyerMonth = () => {
    const upkeep = ownerUpkeep(buyerAge);
    totals.ownerMaintenance += upkeep;
    const step = amortizeMonth(loanBalance, loanRate, loanBalance > 0 ? loanPayment : 0);
    loanBalance = step.balance;
    totals.loanInterest += step.interest;
    totals.loanPrincipal += step.principal;
    buyerAge += 1;
    return step.payment + upkeep;
  };

  const buyerBill = (month: number): { running: number; capital: number } => {
    if (!buyerOwns) return { running: 0, capital: 0 };
    if (buyerJustPurchased) {
      buyerJustPurchased = false;
      return { running: 0, capital: 0 };
    }
    if (buyerAge >= ownershipMonths) {
      const net = quoteBuyerReplacement();
      const reference = continuingLeaseRunning(month).amount;
      const newLoan = useLoan ? purchasePrice * (1 - downPercent / 100) : 0;
      const paymentIfNew = newLoan > 0 ? annuityPayment(newLoan, loanRate, loanMonths) : 0;
      const inflow = Math.max(0, reference - ownerUpkeep(0) - paymentIfNew);
      if (net <= buyerEtf.afterTaxValue() + inflow + 0.01) {
        const capital = replaceBuyer(month);
        return { running: chargeBuyerMonth(), capital };
      }
      if (!buyerShortfall) {
        buyerShortfall = true;
        warnings.push('The buyer’s ETF cannot cover the next car, so they keep the one they have.');
      }
    }
    return { running: chargeBuyerMonth(), capital: 0 };
  };

  const lesseeBill = (month: number): { running: number; capital: number } => {
    if (lesseeOwns) {
      let capital = 0;
      if (lesseeAge >= ownershipMonths) {
        const net = quoteLesseeReplacement();
        if (net <= lesseeEtf.afterTaxValue() + 0.01) capital = replaceLessee();
        else if (!lesseeShortfall) {
          lesseeShortfall = true;
          warnings.push('The lessee’s ETF cannot cover the next car, so they keep the one they have.');
        }
      }
      const upkeep = ownerUpkeep(lesseeAge);
      totals.lesseeOwnerMaintenance += upkeep;
      lesseeAge += 1;
      return { running: upkeep, capital };
    }
    if (!leaseOpen || leaseStartMonth === null) return { running: 0, capital: 0 };
    const scheduled = continuingLeaseRunning(month);
    totals.leasePayments += monthlyLease;
    totals.leaseMaintenance += nonNegative(input.leaseMaintenance);
    if (scheduled.renewal) {
      totals.specialPayments += special;
      totals.transferFees += transfer;
      contracts += 1;
    }
    let capital = 0;
    const contractEnd = leaseStartMonth + term - 1;
    if (buyAfterLease && month === contractEnd) {
      const cost = buyoutPrice + registration;
      if (cost <= lesseeEtf.afterTaxValue() + 0.01) {
        capital = cost;
        totals.lesseeBuyout += buyoutPrice;
        totals.lesseeRegistration += registration;
        lesseeOwns = true;
        lesseeAge = term;
        lesseeBasis = buyoutPrice;
        lesseePurchases += 1;
        leaseOpen = false;
        buyoutMonth = month;
      } else if (!lesseeShortfall) {
        lesseeShortfall = true;
        warnings.push('The lessee’s ETF cannot cover the buyout, so the lease continues.');
      }
    }
    return { running: scheduled.amount, capital };
  };

  const noteShortfall = (who: 'buyer' | 'lessee', raised: number, needed: number) => {
    if (raised + 0.5 >= needed) return;
    if (who === 'buyer' && !buyerShortfall) {
      buyerShortfall = true;
      warnings.push('The buyer’s ETF cannot cover a car purchase. The shortfall is not borrowed.');
    }
    if (who === 'lessee' && !lesseeShortfall) {
      lesseeShortfall = true;
      warnings.push('The lessee’s ETF cannot cover a payment. The shortfall is not borrowed.');
    }
  };

  const settleCapital = (who: 'buyer' | 'lessee', amount: number) => {
    if (!(amount > 0) && !(amount < 0)) return;
    const account = who === 'buyer' ? buyerEtf : lesseeEtf;
    if (amount > 0) {
      const raised = account.withdrawNet(amount);
      if (who === 'buyer') totals.buyerEtfWithdrawals += raised;
      else totals.lesseeEtfWithdrawals += raised;
      noteShortfall(who, raised, amount);
    } else {
      account.deposit(-amount);
      if (who === 'buyer') totals.buyerEtfContributions += -amount;
      else totals.lesseeEtfContributions += -amount;
    }
  };

  const fund = (who: 'buyer' | 'lessee', costs: number) => {
    const account = who === 'buyer' ? buyerEtf : lesseeEtf;
    const net = monthlySavings - costs;
    if (net > 0) {
      account.deposit(net);
      if (who === 'buyer') totals.buyerEtfContributions += net;
      else totals.lesseeEtfContributions += net;
    } else if (net < 0) {
      const raised = account.withdrawNet(-net);
      if (who === 'buyer') totals.buyerEtfWithdrawals += raised;
      else totals.lesseeEtfWithdrawals += raised;
      noteShortfall(who, raised, -net);
    }
  };

  const point = (month: number, buyerCash: number, lesseeCash: number): LeasingPoint => {
    const carValue = buyerOwns ? valueOf(buyerAge) : 0;
    const lesseeCarValue = lesseeOwns ? valueOf(lesseeAge) : 0;
    const carEquity = carValue - loanBalance;
    const buyerEtfNet = buyerEtf.afterTaxValue();
    const lesseeEtfNet = lesseeEtf.afterTaxValue();
    return {
      month,
      label: horizonLabel(month),
      carValue,
      loanBalance,
      carEquity,
      lesseeCarValue,
      lesseeCarEquity: lesseeCarValue,
      buyerEtfNet,
      lesseeEtfNet,
      buyerNet: carEquity + buyerEtfNet,
      lesseeNet: lesseeCarValue + lesseeEtfNet,
      buyerCash,
      lesseeCash,
      buyerMarketGain: marketGain(
        buyerEtfNet,
        totals.buyerEtfContributions,
        totals.buyerEtfWithdrawals,
      ),
      lesseeMarketGain: marketGain(
        lesseeEtfNet,
        totals.lesseeEtfContributions,
        totals.lesseeEtfWithdrawals,
      ),
    };
  };

  const points: LeasingPoint[] = [point(0, buyerInitialCash, lesseeInitialCash)];

  for (let month = 1; month <= months; month += 1) {
    buyerEtf.accrueMonth(msciMonthly);
    lesseeEtf.accrueMonth(msciMonthly);

    let purchasedThisMonth = false;
    if (sameCapital && !acquired && purchasePrice > 0) {
      const projected = buyerEtf.afterTaxValue() + monthlySavings;
      if (projected + 0.01 >= cashNeeded) {
        acquired = true;
        purchasedThisMonth = true;
        acquisitionMonth = month;
        leaseStartMonth = month;
        leaseOpen = true;
        contracts = 1;
        buyerOwns = true;
        buyerAge = 0;
        buyerBasis = purchasePrice;
        buyerPurchases = 1;
        buyerJustPurchased = true;
        totals.registration += registration;
      }
    }

    let buyerCash = 0;
    let lesseeCash = 0;
    if (sameCapital && !acquired) {
      buyerEtf.deposit(monthlySavings);
      lesseeEtf.deposit(monthlySavings);
      totals.buyerEtfContributions += monthlySavings;
      totals.lesseeEtfContributions += monthlySavings;
    } else {
      const buyerPart = buyerBill(month);
      const lesseePart = lesseeBill(month);
      buyerCash = buyerPart.running + buyerPart.capital;
      lesseeCash = lesseePart.running + lesseePart.capital;
      if (purchasedThisMonth) buyerCash += cashNeeded;
      if (sameCapital) {
        if (purchasedThisMonth) {
          buyerEtf.deposit(monthlySavings);
          totals.buyerEtfContributions += monthlySavings;
          const raised = buyerEtf.withdrawNet(cashNeeded);
          totals.buyerEtfWithdrawals += raised;
          buyerUnfunded += Math.max(0, cashNeeded - raised);
          noteShortfall('buyer', raised, cashNeeded);
          fund('lessee', lesseePart.running + lesseePart.capital);
        } else {
          fund('buyer', buyerPart.running + buyerPart.capital);
          fund('lessee', lesseePart.running + lesseePart.capital);
        }
      } else {
        const reference = continuingLeaseRunning(month).amount;
        const gap = buyerPart.running - reference;
        if (gap > 0) {
          lesseeEtf.deposit(gap);
          totals.lesseeEtfContributions += gap;
        } else if (gap < 0) {
          buyerEtf.deposit(-gap);
          totals.buyerEtfContributions += -gap;
        }
        const lesseeSaving = reference - lesseePart.running;
        if (lesseeSaving > 0.005) {
          lesseeEtf.deposit(lesseeSaving);
          totals.lesseeEtfContributions += lesseeSaving;
        } else if (lesseeSaving < -0.005) {
          const raised = lesseeEtf.withdrawNet(-lesseeSaving);
          totals.lesseeEtfWithdrawals += raised;
        }
        settleCapital('buyer', buyerPart.capital);
        settleCapital('lessee', lesseePart.capital);
      }
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

  if (leaseStartMonth !== null && !buyAfterLease) {
    const payments = months - leaseStartMonth + 1;
    if (payments > 0 && payments % term !== 0) {
      warnings.push(
        'The horizon is not a whole number of lease contracts. The last contract is assumed to stop at the horizon, with no extra early-return fee.',
      );
    }
  }
  if (buyAfterLease && leaseStartMonth !== null && buyoutMonth === null) {
    warnings.push('The lease runs past the horizon, so the car is not bought at the end of the contract.');
  }
  if (sameCapital && !acquired && purchasePrice > 0) {
    warnings.push(
      'The monthly savings do not reach the car price within the horizon, so the car is never bought and the lease never starts.',
    );
  }

  if (buyerOwns) totals.depreciation += buyerBasis - valueOf(buyerAge);
  if (lesseeOwns) totals.lesseeDepreciation += lesseeBasis - valueOf(lesseeAge);

  const final = points[points.length - 1];
  totals.buyerUnfunded = buyerUnfunded;
  totals.lesseeUnfunded = lesseeUnfunded;
  totals.buyerExpenditure =
    totals.depreciation +
    totals.loanInterest +
    totals.ownerMaintenance +
    totals.registration +
    buyerUnfunded;
  totals.lesseeExpenditure =
    totals.leasePayments +
    totals.specialPayments +
    totals.transferFees +
    totals.leaseMaintenance +
    totals.lesseeOwnerMaintenance +
    totals.lesseeDepreciation +
    totals.lesseeRegistration +
    lesseeUnfunded;

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
    finalCarValue: final?.carValue ?? 0,
    totals,
    finalBuyerNet: final?.buyerNet ?? 0,
    finalLesseeNet: final?.lesseeNet ?? 0,
    warnings,
    buyerPurchases,
    lesseePurchases,
    acquisitionMonth,
    buyoutMonth,
    buyoutPrice: buyAfterLease ? buyoutPrice : null,
    buyerMarketGain: final?.buyerMarketGain ?? 0,
    lesseeMarketGain: final?.lesseeMarketGain ?? 0,
    ownershipMonths,
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
    buyerPurchases: 0,
    lesseePurchases: 0,
    acquisitionMonth: null,
    buyoutMonth: null,
    buyoutPrice: null,
    buyerMarketGain: 0,
    lesseeMarketGain: 0,
    ownershipMonths: 0,
  };
}
