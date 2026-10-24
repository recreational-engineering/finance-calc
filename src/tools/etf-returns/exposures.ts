/**
 * Markets the ETF list is mapped onto.
 *
 * History figures are measured euro total returns, or an MSCI net euro
 * factsheet number, and the label says which window. A hot decade is stored
 * as `recent` and is not the history that enters the blend.
 *
 * Forward pieces for equities are a dividend-discount build for October 2026:
 * dividend yield, net buybacks, real growth, euro inflation, and a valuation
 * gap that closes over the chosen horizon. `valuation` is a fair price divided
 * by today's price. Below 1, the market is rich and the forward return is cut.
 *
 * Bond forwards are yields, not a blend with the last decade. Falling rates
 * lifted past bond returns; the yield does not repeat that.
 */

export type ExposureKind = 'equity' | 'bond' | 'gold' | 'commodity' | 'crypto' | 'cash' | 'blend';

export type HedgeBucket = 'none' | 'usd' | 'global' | 'europe' | 'other';

export interface RecentWindow {
  annualPercent: number;
  years: number;
  label: string;
}

export interface Exposure {
  id: string;
  label: string;
  kind: ExposureKind;
  hedgeBucket: HedgeBucket;
  volatility: number;
  historyAnnualPercent: number | null;
  historyYears: number;
  historyLabel: string;
  recent?: RecentWindow;
  /** Equities: dividend, net buyback, real growth, fair/current price. */
  dividendYield?: number;
  netBuybackYield?: number;
  realGrowth?: number;
  valuation?: number;
  /** Nominal bonds: yield and an annual credit loss. */
  yieldPercent?: number;
  creditLossPercent?: number;
  /** Linkers and gold: real return before euro inflation. Gold's is zero. */
  realPremium?: number;
  mix?: { id: string; weight: number }[];
  caution?: string;
}

interface EquityInput {
  id: string;
  label: string;
  hedge: HedgeBucket;
  vol: number;
  dividend: number;
  buyback: number;
  growth: number;
  valuation: number;
  history?: number;
  years?: number;
  historyLabel?: string;
  recent?: RecentWindow;
  caution?: string;
}

function equity(input: EquityInput): Exposure {
  return {
    id: input.id,
    label: input.label,
    kind: 'equity',
    hedgeBucket: input.hedge,
    volatility: input.vol,
    historyAnnualPercent: input.history ?? null,
    historyYears: input.years ?? 0,
    historyLabel: input.historyLabel ?? '',
    recent: input.recent,
    dividendYield: input.dividend,
    netBuybackYield: input.buyback,
    realGrowth: input.growth,
    valuation: input.valuation,
    caution: input.caution,
  };
}

interface BondInput {
  id: string;
  label: string;
  hedge: HedgeBucket;
  vol: number;
  yieldPercent: number;
  creditLossPercent?: number;
  realPremium?: number;
  caution?: string;
}

function bond(input: BondInput): Exposure {
  const linker = input.realPremium != null;
  return {
    id: input.id,
    label: input.label,
    kind: 'bond',
    hedgeBucket: input.hedge,
    volatility: input.vol,
    historyAnnualPercent: null,
    historyYears: 0,
    historyLabel: '',
    yieldPercent: linker ? undefined : input.yieldPercent,
    creditLossPercent: input.creditLossPercent ?? 0,
    realPremium: input.realPremium,
    caution: input.caution,
  };
}

const equities: Exposure[] = [
  equity({
    id: 'world',
    label: 'Developed world equities',
    hedge: 'global',
    vol: 15,
    dividend: 1.7,
    buyback: 0.9,
    growth: 1.5,
    valuation: 0.82,
    history: 6.67,
    years: 25.8,
    historyLabel: 'MSCI World net total return in euro, 31 Dec 2000–30 Sep 2026 (MSCI factsheet).',
    recent: {
      annualPercent: 12.7,
      years: 17.1,
      label: 'iShares Core MSCI World in euro, Sep 2009–Oct 2026. The window opens after the 2008 crash, so it is not the long-term base.',
    },
  }),
  equity({
    id: 'acwi',
    label: 'All-country equities',
    hedge: 'global',
    vol: 15,
    dividend: 1.8,
    buyback: 0.8,
    growth: 1.7,
    valuation: 0.84,
    history: 6.62,
    years: 25.8,
    historyLabel: 'MSCI ACWI net total return in euro, 31 Dec 2000–30 Sep 2026 (MSCI factsheet).',
  }),
  equity({
    id: 'usa',
    label: 'US large-cap equities',
    hedge: 'usd',
    vol: 16,
    dividend: 1.2,
    buyback: 1.5,
    growth: 1.6,
    valuation: 0.72,
    history: 11.4,
    years: 22.7,
    historyLabel: 'S&P 500 total return, converted from dollars to euro, Jan 2004–Oct 2026.',
    recent: {
      annualPercent: 13.7,
      years: 16.4,
      label: 'iShares Core S&P 500 in euro, May 2010–Oct 2026.',
    },
  }),
  equity({
    id: 'nasdaq',
    label: 'Nasdaq-100',
    hedge: 'usd',
    vol: 19,
    dividend: 0.6,
    buyback: 1.0,
    growth: 2.2,
    valuation: 0.62,
    history: 18.4,
    years: 16.4,
    historyLabel: 'iShares Nasdaq-100 in euro, May 2010–Oct 2026. This misses the dot-com bust.',
  }),
  equity({
    id: 'tech',
    label: 'Information technology',
    hedge: 'usd',
    vol: 20,
    dividend: 0.6,
    buyback: 1.2,
    growth: 2.4,
    valuation: 0.58,
    history: 24.5,
    years: 10.8,
    historyLabel: 'iShares S&P 500 Information Technology in euro, 2016–Oct 2026. A very strong decade.',
  }),
  equity({
    id: 'europe',
    label: 'Developed Europe equities',
    hedge: 'europe',
    vol: 15,
    dividend: 3.0,
    buyback: 0.4,
    growth: 1.2,
    valuation: 0.95,
    history: 5.9,
    years: 18.7,
    historyLabel: 'iShares STOXX Europe 600 in euro, Jan 2008–Oct 2026, including the 2008 crash.',
  }),
  equity({
    id: 'emu',
    label: 'Eurozone equities',
    hedge: 'europe',
    vol: 17,
    dividend: 3.0,
    buyback: 0.3,
    growth: 1.1,
    valuation: 0.93,
    history: 5.9,
    years: 18.7,
    historyLabel: 'Developed Europe in euro, Jan 2008–Oct 2026, used as the stand-in for the eurozone.',
  }),
  equity({
    id: 'germany',
    label: 'German equities',
    hedge: 'europe',
    vol: 18,
    dividend: 2.7,
    buyback: 0.3,
    growth: 1.0,
    valuation: 0.92,
    history: 6.4,
    years: 18.7,
    historyLabel: 'iShares Core DAX in euro, Jan 2008–Oct 2026, including the 2008 crash.',
  }),
  equity({
    id: 'uk',
    label: 'UK equities',
    hedge: 'other',
    vol: 15,
    dividend: 3.4,
    buyback: 0.3,
    growth: 1.0,
    valuation: 1.05,
  }),
  equity({
    id: 'japan',
    label: 'Japanese equities',
    hedge: 'other',
    vol: 16,
    dividend: 2.1,
    buyback: 0.6,
    growth: 1.0,
    valuation: 0.9,
  }),
  equity({
    id: 'pacific',
    label: 'Pacific equities',
    hedge: 'other',
    vol: 16,
    dividend: 2.4,
    buyback: 0.3,
    growth: 1.2,
    valuation: 0.95,
  }),
  equity({
    id: 'em',
    label: 'Emerging-market equities',
    hedge: 'other',
    vol: 20,
    dividend: 2.5,
    buyback: 0.2,
    growth: 2.2,
    valuation: 1,
    history: 8.31,
    years: 25.8,
    historyLabel: 'MSCI Emerging Markets net total return in euro, 31 Dec 2000–30 Sep 2026 (MSCI factsheet).',
    recent: {
      annualPercent: 6.9,
      years: 17,
      label: 'iShares MSCI Emerging Markets in euro, Oct 2009–Oct 2026.',
    },
  }),
  equity({
    id: 'china',
    label: 'Chinese equities',
    hedge: 'other',
    vol: 24,
    dividend: 2.2,
    buyback: 0.1,
    growth: 1.2,
    valuation: 1.1,
  }),
  equity({
    id: 'india',
    label: 'Indian equities',
    hedge: 'other',
    vol: 20,
    dividend: 1.2,
    buyback: 0.2,
    growth: 2.8,
    valuation: 0.75,
  }),
  equity({
    id: 'dm-country',
    label: 'Single developed market',
    hedge: 'other',
    vol: 17,
    dividend: 2.4,
    buyback: 0.4,
    growth: 1.2,
    valuation: 0.95,
  }),
  equity({
    id: 'em-country',
    label: 'Single emerging market',
    hedge: 'other',
    vol: 24,
    dividend: 2.4,
    buyback: 0.1,
    growth: 1.8,
    valuation: 0.95,
  }),
  equity({
    id: 'energy',
    label: 'Energy equities',
    hedge: 'global',
    vol: 25.5,
    dividend: 3.2,
    buyback: 0.3,
    growth: 0.5,
    valuation: 0.95,
    history: 10.7,
    years: 10.5,
    historyLabel: 'Xtrackers MSCI World Energy in euro, Apr 2016–Oct 2026. The window includes the 2020 crash and the rally through 2026.',
  }),
  equity({
    id: 'financials',
    label: 'Financials',
    hedge: 'global',
    vol: 18,
    dividend: 2.7,
    buyback: 0.6,
    growth: 1.2,
    valuation: 0.92,
  }),
  equity({
    id: 'health',
    label: 'Health care',
    hedge: 'global',
    vol: 14,
    dividend: 1.6,
    buyback: 0.6,
    growth: 1.8,
    valuation: 0.88,
  }),
  equity({
    id: 'biotech',
    label: 'Biotechnology',
    hedge: 'usd',
    vol: 25,
    dividend: 0.4,
    buyback: 0.2,
    growth: 2.0,
    valuation: 0.8,
  }),
  equity({
    id: 'industrials',
    label: 'Industrials',
    hedge: 'global',
    vol: 16,
    dividend: 1.6,
    buyback: 0.6,
    growth: 1.4,
    valuation: 0.88,
  }),
  equity({
    id: 'staples',
    label: 'Consumer staples',
    hedge: 'global',
    vol: 12,
    dividend: 2.6,
    buyback: 0.4,
    growth: 1.0,
    valuation: 0.92,
  }),
  equity({
    id: 'discretionary',
    label: 'Consumer discretionary',
    hedge: 'global',
    vol: 18,
    dividend: 1.2,
    buyback: 0.8,
    growth: 1.6,
    valuation: 0.8,
  }),
  equity({
    id: 'materials',
    label: 'Materials',
    hedge: 'global',
    vol: 18,
    dividend: 2.2,
    buyback: 0.2,
    growth: 1.0,
    valuation: 0.95,
  }),
  equity({
    id: 'utilities',
    label: 'Utilities',
    hedge: 'global',
    vol: 14,
    dividend: 3.3,
    buyback: 0,
    growth: 0.7,
    valuation: 0.98,
  }),
  equity({
    id: 'communication',
    label: 'Communication services',
    hedge: 'global',
    vol: 16,
    dividend: 1.3,
    buyback: 1.0,
    growth: 1.4,
    valuation: 0.85,
  }),
  equity({
    id: 'real-estate',
    label: 'Listed real estate',
    hedge: 'global',
    vol: 18,
    dividend: 3.4,
    buyback: -0.2,
    growth: 0.6,
    valuation: 0.9,
  }),
  equity({
    id: 'infrastructure',
    label: 'Infrastructure equities',
    hedge: 'global',
    vol: 15,
    dividend: 3.0,
    buyback: 0,
    growth: 1.0,
    valuation: 0.92,
  }),
  equity({
    id: 'water',
    label: 'Water equities',
    hedge: 'global',
    vol: 15,
    dividend: 1.6,
    buyback: 0.3,
    growth: 1.4,
    valuation: 0.85,
  }),
  equity({
    id: 'robotics',
    label: 'Robotics and AI equities',
    hedge: 'global',
    vol: 23,
    dividend: 0.6,
    buyback: 0.4,
    growth: 2.2,
    valuation: 0.72,
    history: 15.4,
    years: 8,
    historyLabel: 'Amundi MSCI Robotics & AI in euro, Oct 2018–Oct 2026. Eight years, and a strong finish.',
  }),
  equity({
    id: 'semiconductors',
    label: 'Semiconductor equities',
    hedge: 'usd',
    vol: 28,
    dividend: 0.7,
    buyback: 1.0,
    growth: 2.6,
    valuation: 0.55,
  }),
  equity({
    id: 'defense',
    label: 'Defence equities',
    hedge: 'europe',
    vol: 20,
    dividend: 1.2,
    buyback: 0.4,
    growth: 1.6,
    valuation: 0.75,
  }),
  equity({
    id: 'clean-energy',
    label: 'Clean-energy equities',
    hedge: 'global',
    vol: 24,
    dividend: 1.2,
    buyback: 0,
    growth: 1.8,
    valuation: 1.05,
  }),
  equity({
    id: 'dividend',
    label: 'Dividend equities',
    hedge: 'global',
    vol: 14,
    dividend: 3.2,
    buyback: 0.2,
    growth: 0.8,
    valuation: 1,
  }),
  equity({
    id: 'quality',
    label: 'Quality equities',
    hedge: 'global',
    vol: 14,
    dividend: 1.6,
    buyback: 1.0,
    growth: 1.8,
    valuation: 0.85,
  }),
  equity({
    id: 'momentum',
    label: 'Momentum equities',
    hedge: 'global',
    vol: 16,
    dividend: 1.1,
    buyback: 0.8,
    growth: 1.6,
    valuation: 0.75,
  }),
  equity({
    id: 'value',
    label: 'Value equities',
    hedge: 'global',
    vol: 16,
    dividend: 2.8,
    buyback: 0.4,
    growth: 1.0,
    valuation: 1.05,
  }),
  equity({
    id: 'min-vol',
    label: 'Minimum-volatility equities',
    hedge: 'global',
    vol: 12,
    dividend: 2.2,
    buyback: 0.4,
    growth: 1.0,
    valuation: 0.9,
  }),
  equity({
    id: 'small-cap',
    label: 'Small-cap equities',
    hedge: 'global',
    vol: 17,
    dividend: 1.6,
    buyback: 0.3,
    growth: 1.7,
    valuation: 0.95,
    history: 9.3,
    years: 8.5,
    historyLabel: 'iShares MSCI World Small Cap in euro, Apr 2018–Oct 2026.',
  }),
  equity({
    id: 'metals',
    label: 'Metal-producer equities',
    hedge: 'global',
    vol: 28,
    dividend: 2.0,
    buyback: 0.1,
    growth: 1.3,
    valuation: 0.9,
    caution: 'These are mining companies, not the metal. Earnings swing with the cycle, so the forward build stays modest.',
  }),
  equity({
    id: 'gold-miners',
    label: 'Gold-miner equities',
    hedge: 'usd',
    vol: 32,
    dividend: 1.4,
    buyback: 0,
    growth: 0.6,
    valuation: 0.9,
    caution: 'Miners are a leveraged bet on the gold price, with operating and dilution risk the metal itself does not have.',
  }),
  equity({
    id: 'equity-other',
    label: 'Broad equities',
    hedge: 'global',
    vol: 16,
    dividend: 1.7,
    buyback: 0.8,
    growth: 1.4,
    valuation: 0.85,
    caution: 'The name did not match a more specific market, so this uses a broad equity build.',
  }),
];

const bonds: Exposure[] = [
  bond({ id: 'euro-gov', label: 'Euro government bonds', hedge: 'europe', vol: 5, yieldPercent: 2.9 }),
  bond({ id: 'euro-gov-short', label: 'Short euro government bonds', hedge: 'europe', vol: 2, yieldPercent: 2.4 }),
  bond({ id: 'euro-gov-long', label: 'Long euro government bonds', hedge: 'europe', vol: 9, yieldPercent: 3.3 }),
  bond({
    id: 'euro-linker',
    label: 'Euro inflation-linked bonds',
    hedge: 'europe',
    vol: 6,
    yieldPercent: 0,
    realPremium: 0.5,
  }),
  bond({ id: 'euro-ig', label: 'Euro investment-grade credit', hedge: 'europe', vol: 5, yieldPercent: 3.4, creditLossPercent: 0.2 }),
  bond({ id: 'euro-hy', label: 'Euro high-yield credit', hedge: 'europe', vol: 8, yieldPercent: 5.6, creditLossPercent: 1.6 }),
  bond({ id: 'euro-covered', label: 'Covered bonds and Pfandbriefe', hedge: 'europe', vol: 3, yieldPercent: 2.85, creditLossPercent: 0.05 }),
  bond({ id: 'us-treasury', label: 'US Treasuries', hedge: 'usd', vol: 6, yieldPercent: 4.2 }),
  bond({ id: 'us-treasury-short', label: 'Short US Treasuries', hedge: 'usd', vol: 2, yieldPercent: 4.0 }),
  bond({ id: 'us-treasury-long', label: 'Long US Treasuries', hedge: 'usd', vol: 12, yieldPercent: 4.4 }),
  bond({
    id: 'us-linker',
    label: 'US inflation-linked bonds',
    hedge: 'usd',
    vol: 6,
    yieldPercent: 0,
    realPremium: 1.8,
  }),
  bond({ id: 'us-ig', label: 'US investment-grade credit', hedge: 'usd', vol: 6, yieldPercent: 4.9, creditLossPercent: 0.3 }),
  bond({ id: 'us-hy', label: 'US high-yield credit', hedge: 'usd', vol: 8, yieldPercent: 6.8, creditLossPercent: 1.8 }),
  bond({ id: 'uk-gilt', label: 'UK gilts', hedge: 'other', vol: 7, yieldPercent: 4.3 }),
  bond({ id: 'global-bond', label: 'Global bonds', hedge: 'global', vol: 6, yieldPercent: 3.6, creditLossPercent: 0.25 }),
  bond({ id: 'em-bond', label: 'Emerging-market hard-currency bonds', hedge: 'usd', vol: 10, yieldPercent: 6.4, creditLossPercent: 1.3 }),
  bond({ id: 'em-bond-local', label: 'Emerging-market local bonds', hedge: 'other', vol: 12, yieldPercent: 6.0, creditLossPercent: 0.4 }),
];

const others: Exposure[] = [
  {
    id: 'gold',
    label: 'Gold',
    kind: 'gold',
    hedgeBucket: 'none',
    volatility: 16,
    historyAnnualPercent: 9.6,
    historyYears: 16.9,
    historyLabel: 'Xetra-Gold price in euro, Nov 2009–Oct 2026. The note follows the gold price. This window is a gold bull market.',
    realPremium: 0,
  },
  {
    id: 'commodity',
    label: 'Broad commodities',
    kind: 'commodity',
    hedgeBucket: 'usd',
    volatility: 16,
    historyAnnualPercent: null,
    historyYears: 0,
    historyLabel: '',
    realPremium: 0,
    caution: 'A broad commodity index has no cash yield. Roll costs on futures can take more than this flat real assumption.',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    kind: 'crypto',
    hedgeBucket: 'none',
    volatility: 60,
    historyAnnualPercent: null,
    historyYears: 0,
    historyLabel: '',
    realPremium: 0,
    caution: 'There is no cash yield to discount. The planning rate does not project the past price boom forward.',
  },
  {
    id: 'cash',
    label: 'Euro cash',
    kind: 'cash',
    hedgeBucket: 'europe',
    volatility: 0.5,
    historyAnnualPercent: null,
    historyYears: 0,
    historyLabel: '',
  },
  {
    id: 'balanced',
    label: 'Balanced multi-asset',
    kind: 'blend',
    hedgeBucket: 'global',
    volatility: 10,
    historyAnnualPercent: null,
    historyYears: 0,
    historyLabel: '',
    mix: [
      { id: 'world', weight: 0.6 },
      { id: 'euro-gov', weight: 0.4 },
    ],
    caution: 'Treated as 60% developed world equities and 40% euro government bonds.',
  },
];

const ALL: Exposure[] = [...equities, ...bonds, ...others];

export const EXPOSURES: ReadonlyMap<string, Exposure> = new Map(ALL.map((item) => [item.id, item]));

export function exposureById(id: string): Exposure {
  const found = EXPOSURES.get(id);
  if (!found) throw new Error(`Unknown exposure ${id}`);
  return found;
}
