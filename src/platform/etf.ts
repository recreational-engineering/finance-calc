/**
 * Accumulating equity ETF with a planning-grade German tax model.
 *
 * Vorabpauschale (§18 InvStG) is approximated on the value at the start of each
 * simulation year, capped by that year's actual gain. New contributions during
 * the year do not themselves generate a deemed return. Equity Teilfreistellung
 * is 30%. Tax is Abgeltungsteuer plus Solidaritätszuschlag (26.375%).
 * Kirchensteuer is not included. The annual allowance resets every 12 months
 * of the simulation, which stands in for the calendar-year Sparerpauschbetrag.
 *
 * Paid Vorabpauschale increases the cost basis so a later sale is not taxed twice.
 * Reported net worth deducts the tax that would be due if the position were sold
 * that month. While the position is held, only the yearly Vorabpauschale actually
 * leaves the portfolio.
 */

export interface EtfTaxSettings {
  enabled: boolean;
  /** Decimal, e.g. 0.032 for the 2026 Basiszins. */
  basiszins: number;
  /** Annual Sparerpauschbetrag in euro. */
  allowance: number;
  teilfreistellung: number;
  /** Combined Abgeltungsteuer and Solidaritätszuschlag. */
  taxRate: number;
}

export const EQUITY_TEILFREISTELLUNG = 0.3;
export const ABGELTUNG_WITH_SOLI = 0.25 * 1.055;

export function taxSettings(input: {
  enabled: boolean;
  basiszinsPercent: number;
  allowance: number;
}): EtfTaxSettings {
  return {
    enabled: input.enabled,
    basiszins: (Number.isFinite(input.basiszinsPercent) ? input.basiszinsPercent : 0) / 100,
    allowance: Math.max(0, Number.isFinite(input.allowance) ? input.allowance : 0),
    teilfreistellung: EQUITY_TEILFREISTELLUNG,
    taxRate: ABGELTUNG_WITH_SOLI,
  };
}

export class EtfAccount {
  value = 0;
  contributions = 0;
  /** Gross Vorabpauschale already assessed; added to Anschaffungskosten. */
  costBasisUplift = 0;
  taxesPaid = 0;
  allowanceUsedThisYear = 0;
  yearStartValue = 0;
  contributionsThisYear = 0;

  constructor(private readonly tax: EtfTaxSettings) {}

  /**
   * @param countsTowardYear false for the opening balance, which is the start
   * value of year one rather than a contribution during that year.
   */
  deposit(amount: number, countsTowardYear = true): void {
    if (!(amount > 0)) return;
    this.value += amount;
    this.contributions += amount;
    if (countsTowardYear) this.contributionsThisYear += amount;
  }

  accrueMonth(monthlyReturn: number): void {
    if (!Number.isFinite(monthlyReturn) || this.value === 0) return;
    this.value *= 1 + monthlyReturn;
  }

  /** Assess one simulation year of Vorabpauschale. Does not roll the year. */
  endYear(yearFraction = 1): void {
    if (!this.tax.enabled || yearFraction <= 0) return;
    const gain = this.value - this.yearStartValue - this.contributionsThisYear;
    const basis = Math.max(0, this.yearStartValue * this.tax.basiszins * 0.7 * yearFraction);
    const vorab = Math.max(0, Math.min(basis, Math.max(0, gain)));
    const taxableBase = vorab * (1 - this.tax.teilfreistellung);
    const room = Math.max(0, this.tax.allowance - this.allowanceUsedThisYear);
    const used = Math.min(room, taxableBase);
    const tax = Math.max(0, taxableBase - used) * this.tax.taxRate;
    this.value = Math.max(0, this.value - tax);
    this.taxesPaid += tax;
    this.costBasisUplift += vorab;
    this.allowanceUsedThisYear += used;
  }

  rollYear(): void {
    this.yearStartValue = this.value;
    this.contributionsThisYear = 0;
    this.allowanceUsedThisYear = 0;
  }

  /** Value after the tax due on a sale today. */
  afterTaxValue(): number {
    return Math.max(0, this.value - this.exitTax());
  }

  exitTax(): number {
    if (!this.tax.enabled) return 0;
    const gain = Math.max(0, this.value - this.contributions - this.costBasisUplift);
    const taxableBase = gain * (1 - this.tax.teilfreistellung);
    const room = Math.max(0, this.tax.allowance - this.allowanceUsedThisYear);
    return Math.max(0, taxableBase - room) * this.tax.taxRate;
  }
}
