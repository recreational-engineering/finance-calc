/**
 * Dial-in inputs for the long-term ETF estimate. Dated to 22–24 Oct 2026.
 * Equity and gold forwards add euro inflation. Bond forwards do not: a yield
 * is already a nominal return. Leveraged products pay `financingPercent` on
 * each extra turn of exposure.
 */
export interface MarketAssumptions {
  /** Years over which a rich or cheap valuation is assumed to fade. */
  horizonYears: number;
  /** Euro inflation added to real equity, gold, and linker expectations. */
  inflationPercent: number;
  /**
   * Cost of borrowing one extra unit of exposure, in percent a year.
   * Starting point: SOFR 3.90% on 22 Oct 2026 plus a 0.50 point swap spread.
   */
  financingPercent: number;
  /**
   * Financing cost used only when a long history is restated for leverage.
   * Cash rates were lower over that window than they are now.
   */
  historyFinancingPercent: number;
  /**
   * USD cash minus euro cash. Hedging dollar assets back to euro subtracts this.
   * Starting point: SOFR 3.90% minus €STR 2.44% on 22 Oct 2026.
   */
  usdHedgeCostPercent: number;
  /** Euro overnight yield. €STR was 2.44% on 22 Oct 2026. */
  eurCashPercent: number;
}

export const DEFAULT_ASSUMPTIONS: MarketAssumptions = {
  horizonYears: 30,
  inflationPercent: 2,
  financingPercent: 4.4,
  historyFinancingPercent: 1.75,
  usdHedgeCostPercent: 1.46,
  eurCashPercent: 2.44,
};

export const ASSUMPTIONS_KEY = 'klarwert:v1:etf-assumptions';

export function reviveAssumptions(value: unknown): MarketAssumptions | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<MarketAssumptions>;
  return {
    horizonYears: Number(raw.horizonYears),
    inflationPercent: Number(raw.inflationPercent),
    financingPercent: Number(raw.financingPercent),
    historyFinancingPercent: Number(raw.historyFinancingPercent),
    usdHedgeCostPercent: Number(raw.usdHedgeCostPercent),
    eurCashPercent: Number(raw.eurCashPercent),
  };
}
