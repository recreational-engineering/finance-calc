import { describe, expect, it } from 'vitest';
import { EtfAccount, taxSettings } from './etf';
import { effectiveMonthlyRate } from './rates';

const settings = taxSettings({
  enabled: true,
  basiszinsPercent: 3.2,
  allowance: 1000,
});

describe('EtfAccount', () => {
  it('charges Vorabpauschale on the opening value and respects the allowance', () => {
    const account = new EtfAccount(settings);
    account.deposit(100_000, false);
    account.yearStartValue = account.value;
    const monthly = effectiveMonthlyRate(7);
    for (let month = 0; month < 12; month += 1) account.accrueMonth(monthly);

    expect(account.value).toBeCloseTo(107_000, 4);
    account.endYear();

    const basis = 100_000 * 0.032 * 0.7;
    expect(basis).toBeCloseTo(2240, 6);
    const tax = (basis * 0.7 - 1000) * 0.26375;
    expect(account.taxesPaid).toBeCloseTo(tax, 4);
    expect(account.value).toBeCloseTo(107_000 - tax, 4);
    expect(account.costBasisUplift).toBeCloseTo(basis, 4);
  });

  it('does not tax a gain that the allowance absorbs, but still lifts the cost basis', () => {
    const account = new EtfAccount(settings);
    account.deposit(10_000, false);
    account.yearStartValue = account.value;
    const monthly = effectiveMonthlyRate(7);
    for (let month = 0; month < 12; month += 1) account.accrueMonth(monthly);
    account.endYear();

    expect(account.taxesPaid).toBe(0);
    expect(account.costBasisUplift).toBeCloseTo(10_000 * 0.032 * 0.7, 4);
    expect(account.afterTaxValue()).toBeCloseTo(account.value, 6);
  });

  it('taxes the remaining gain on a sale without using the allowance twice', () => {
    const account = new EtfAccount(
      taxSettings({ enabled: true, basiszinsPercent: 3.2, allowance: 0 }),
    );
    account.deposit(100_000, false);
    account.yearStartValue = account.value;
    const monthly = effectiveMonthlyRate(7);
    for (let month = 0; month < 12; month += 1) account.accrueMonth(monthly);
    account.endYear();

    const gain = account.value - account.contributions - account.costBasisUplift;
    const expectedExit = gain * 0.7 * 0.26375;
    expect(account.exitTax()).toBeCloseTo(expectedExit, 4);
    expect(account.afterTaxValue()).toBeCloseTo(account.value - expectedExit, 4);
  });

  it('charges no Vorabpauschale when the fund did not gain', () => {
    const account = new EtfAccount(settings);
    account.deposit(50_000, false);
    account.yearStartValue = account.value;
    account.endYear();
    expect(account.taxesPaid).toBe(0);
    expect(account.costBasisUplift).toBe(0);
  });

  it('raises a chosen after-tax amount and leaves the rest of the gain untouched', () => {
    const account = new EtfAccount(
      taxSettings({ enabled: true, basiszinsPercent: 0, allowance: 0 }),
    );
    account.deposit(10_000, false);
    account.yearStartValue = account.value;
    account.value = 12_000;
    const beforeTax = account.exitTax();
    const net = account.withdrawNet(3_000);
    expect(net).toBeCloseTo(3_000, 4);
    const soldFraction = 1 - account.contributions / 10_000;
    expect(account.exitTax()).toBeCloseTo(beforeTax * (1 - soldFraction), 3);
    expect(account.afterTaxValue() + net).toBeCloseTo(12_000 - beforeTax, 3);
  });

  it('returns principal without tax when the fund has not gained', () => {
    const account = new EtfAccount(
      taxSettings({ enabled: false, basiszinsPercent: 3.2, allowance: 0 }),
    );
    account.deposit(1_000, false);
    expect(account.withdrawNet(400)).toBeCloseTo(400, 6);
    expect(account.value).toBeCloseTo(600, 6);
    expect(account.contributions).toBeCloseTo(600, 6);
  });

  it('skips tax entirely when the setting is off', () => {
    const account = new EtfAccount(
      taxSettings({ enabled: false, basiszinsPercent: 3.2, allowance: 0 }),
    );
    account.deposit(10_000, false);
    account.yearStartValue = 10_000;
    account.accrueMonth(effectiveMonthlyRate(7));
    account.endYear();
    expect(account.taxesPaid).toBe(0);
    expect(account.exitTax()).toBe(0);
  });
});
