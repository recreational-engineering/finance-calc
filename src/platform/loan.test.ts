import { describe, expect, it } from 'vitest';
import { amortizeMonth, annuityPayment, germanMortgagePayment, monthsUntilPayoff } from './loan';

describe('loans', () => {
  it('splits a German mortgage the way banks quote the instalment', () => {
    const loan = 120_000;
    const payment = germanMortgagePayment(loan, 4.5, 2);
    expect(payment).toBeCloseTo(120_000 * 0.065 / 12, 8);
    const step = amortizeMonth(loan, 4.5, payment);
    expect(step.interest).toBeCloseTo(120_000 * 0.045 / 12, 8);
    expect(step.principal).toBeCloseTo(payment - step.interest, 8);
    expect(step.balance).toBeCloseTo(loan - step.principal, 8);
  });

  it('pays a zero-interest loan off in exactly 1 / tilgung years', () => {
    const loan = 12_000;
    const payment = germanMortgagePayment(loan, 0, 20);
    expect(payment).toBeCloseTo(200, 8);
    expect(monthsUntilPayoff(loan, 0, payment)).toBe(60);
  });

  it('does not pretend an interest-only loan is repaid', () => {
    const loan = 100_000;
    const payment = germanMortgagePayment(loan, 4, 0);
    const step = amortizeMonth(loan, 4, payment);
    expect(step.principal).toBe(0);
    expect(step.balance).toBe(loan);
    expect(monthsUntilPayoff(loan, 4, payment)).toBeNull();
  });

  it('clears the remainder on the last month instead of overpaying', () => {
    const step = amortizeMonth(50, 0, 200);
    expect(step.payment).toBeCloseTo(50, 8);
    expect(step.balance).toBe(0);
  });

  it('builds a car-loan annuity that amortizes over the term', () => {
    const payment = annuityPayment(10_000, 6, 48);
    expect(monthsUntilPayoff(10_000, 6, payment)).toBe(48);
  });
});
