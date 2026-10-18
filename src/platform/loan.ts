import { nominalMonthlyRate } from './rates';

export interface AmortizationStep {
  interest: number;
  principal: number;
  payment: number;
  balance: number;
}

/**
 * One month of a German-style annuity.
 * The scheduled payment is fixed. On the last month only the remainder is due.
 * If the scheduled payment does not cover interest, nothing is repaid and the
 * unpaid interest is reported; the balance is left unchanged so a caller can warn.
 */
export function amortizeMonth(
  balance: number,
  annualNominalPercent: number,
  scheduledPayment: number,
): AmortizationStep {
  if (balance <= 0.005) {
    return { interest: 0, principal: 0, payment: 0, balance: 0 };
  }
  const interest = balance * nominalMonthlyRate(annualNominalPercent);
  if (!(scheduledPayment > interest)) {
    return { interest, principal: 0, payment: Math.max(0, scheduledPayment), balance };
  }
  const principal = Math.min(balance, scheduledPayment - interest);
  const payment = interest + principal;
  return {
    interest,
    principal,
    payment,
    balance: Math.max(0, balance - principal),
  };
}

/** Standard fully amortizing payment (car loans). Nominal rate / 12. */
export function annuityPayment(
  principal: number,
  annualNominalPercent: number,
  months: number,
): number {
  if (!(principal > 0) || !(months > 0)) return 0;
  const i = nominalMonthlyRate(annualNominalPercent);
  if (i === 0) return principal / months;
  const factor = Math.pow(1 + i, months);
  return (principal * i * factor) / (factor - 1);
}

/**
 * German mortgage instalment: (nominal interest + initial repayment) / 12,
 * applied to the original loan. The contractual term is whatever this payment
 * produces as the balance falls.
 */
export function germanMortgagePayment(
  loan: number,
  annualNominalPercent: number,
  initialRepaymentPercent: number,
): number {
  if (!(loan > 0)) return 0;
  return (loan * (annualNominalPercent + initialRepaymentPercent)) / 100 / 12;
}

export function monthsUntilPayoff(
  loan: number,
  annualNominalPercent: number,
  payment: number,
  capMonths = 12 * 80,
): number | null {
  if (loan <= 0.005) return 0;
  if (!(payment > 0)) return null;
  let balance = loan;
  for (let month = 1; month <= capMonths; month += 1) {
    const step = amortizeMonth(balance, annualNominalPercent, payment);
    if (step.principal <= 0) return null;
    balance = step.balance;
    if (balance <= 0.005) return month;
  }
  return null;
}
