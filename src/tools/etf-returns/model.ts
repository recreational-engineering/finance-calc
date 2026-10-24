import { clamp, finiteOr } from '../../platform/rates';
import { DEFAULT_ASSUMPTIONS, type MarketAssumptions } from './assumptions';
import type { EtfProduct } from './catalog';
import { exposureById, type Exposure, type ExposureKind, type HedgeBucket } from './exposures';

export interface ReturnLine {
  label: string;
  annualPercent: number;
  note: string;
}

export interface EtfEstimate {
  isin: string;
  name: string;
  shortName: string;
  exposureId: string;
  exposureLabel: string;
  kind: ExposureKind;
  leverage: number;
  hedgedToEur: boolean;
  hedgeCostPercent: number;
  terPercent: number;
  terEstimated: boolean;
  /** Product history after fee, hedge, and leverage. Null when no long window is wired in. */
  historyPercent: number | null;
  historyYears: number;
  historyLabel: string;
  historyWeight: number;
  /** Recent window of the underlying market. Shown, not blended. */
  recent: { annualPercent: number; years: number; label: string } | null;
  forwardPercent: number;
  /** Lines that add up to `forwardPercent`. */
  lines: ReturnLine[];
  /** Economic build of the 1× market, before leverage. Empty when leverage is 1 (it is `lines`). */
  indexLines: ReturnLine[];
  planningPercent: number;
  cautions: string[];
  blendsHistory: boolean;
}

const SHORT_BORROW = 0.5;

export function hedgeCostPercent(bucket: HedgeBucket, assumptions: MarketAssumptions): number {
  const full = assumptions.usdHedgeCostPercent;
  if (bucket === 'usd') return full;
  if (bucket === 'global') return full * 0.7;
  if (bucket === 'other') return full * 0.4;
  return 0;
}

/** Annual percent. Positive `financing` is a cost. */
export function leverageBridge(
  underlyingPercent: number,
  leverage: number,
  volatilityPercent: number,
  financingPercent: number,
  terPercent: number,
): { total: number; decay: number; financing: number } {
  const multiple = leverage;
  const growth = underlyingPercent / 100;
  const sigma = volatilityPercent / 100;
  const decay = 0.5 * multiple * (multiple - 1) * sigma * sigma;
  const borrowed = Math.max(multiple - 1, 0);
  const shorted = Math.max(-multiple, 0);
  const financing = borrowed * (financingPercent / 100) - shorted * (financingPercent / 100 - SHORT_BORROW / 100);
  const total = multiple * growth - decay - financing - terPercent / 100;
  return { total: total * 100, decay: decay * 100, financing: financing * 100 };
}

export function historyBlendWeight(kind: ExposureKind, years: number, hasHistory: boolean): number {
  if (!hasHistory) return 0;
  if (kind === 'bond' || kind === 'cash' || kind === 'crypto' || kind === 'commodity') return 0;
  if (years >= 25) return 0.5;
  if (years >= 15) return 0.4;
  if (years >= 8) return 0.25;
  return 0;
}

export function valuationAnnualPercent(fairOverCurrent: number, horizonYears: number): number {
  if (!(fairOverCurrent > 0) || !(horizonYears > 0)) return 0;
  return (Math.pow(fairOverCurrent, 1 / horizonYears) - 1) * 100;
}

export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sanitizeAssumptions(input: MarketAssumptions): MarketAssumptions {
  return {
    horizonYears: clamp(finiteOr(input.horizonYears, DEFAULT_ASSUMPTIONS.horizonYears), 5, 60),
    inflationPercent: finiteOr(input.inflationPercent, DEFAULT_ASSUMPTIONS.inflationPercent),
    financingPercent: Math.max(0, finiteOr(input.financingPercent, DEFAULT_ASSUMPTIONS.financingPercent)),
    historyFinancingPercent: Math.max(0, finiteOr(input.historyFinancingPercent, DEFAULT_ASSUMPTIONS.historyFinancingPercent)),
    usdHedgeCostPercent: finiteOr(input.usdHedgeCostPercent, DEFAULT_ASSUMPTIONS.usdHedgeCostPercent),
    eurCashPercent: finiteOr(input.eurCashPercent, DEFAULT_ASSUMPTIONS.eurCashPercent),
  };
}

interface Outlook {
  label: string;
  kind: ExposureKind;
  hedgeBucket: HedgeBucket;
  volatility: number;
  historyPercent: number | null;
  historyYears: number;
  historyLabel: string;
  recent: EtfEstimate['recent'];
  forwardPercent: number;
  lines: ReturnLine[];
  caution?: string;
}

function sumLines(lines: ReturnLine[]): number {
  return lines.reduce((total, line) => total + line.annualPercent, 0);
}

function outlookFor(id: string, assumptions: MarketAssumptions, trail: string[]): Outlook {
  const exposure = exposureById(id);
  if (exposure.mix) {
    if (trail.includes(id)) throw new Error(`Cycle in exposure mix at ${id}`);
    return blendOutlook(exposure, assumptions, [...trail, id]);
  }
  const lines = forwardLines(exposure, assumptions);
  return {
    label: exposure.label,
    kind: exposure.kind,
    hedgeBucket: exposure.hedgeBucket,
    volatility: exposure.volatility,
    historyPercent: exposure.historyAnnualPercent,
    historyYears: exposure.historyYears,
    historyLabel: exposure.historyLabel,
    recent: exposure.recent
      ? {
          annualPercent: exposure.recent.annualPercent,
          years: exposure.recent.years,
          label: exposure.recent.label,
        }
      : null,
    forwardPercent: sumLines(lines),
    lines,
    caution: exposure.caution,
  };
}

function blendOutlook(exposure: Exposure, assumptions: MarketAssumptions, trail: string[]): Outlook {
  const parts = (exposure.mix ?? []).map((part) => ({
    weight: part.weight,
    outlook: outlookFor(part.id, assumptions, trail),
  }));
  const weightTotal = parts.reduce((total, part) => total + part.weight, 0) || 1;
  const lines: ReturnLine[] = parts.map((part) => ({
    label: `${part.outlook.label} (${Math.round((part.weight / weightTotal) * 100)}%)`,
    annualPercent: part.outlook.forwardPercent * (part.weight / weightTotal),
    note: 'Share of the mix, using that market’s forward return.',
  }));
  return {
    label: exposure.label,
    kind: 'equity',
    hedgeBucket: exposure.hedgeBucket,
    volatility: exposure.volatility,
    historyPercent: null,
    historyYears: 0,
    historyLabel: '',
    recent: null,
    forwardPercent: sumLines(lines),
    lines,
    caution: exposure.caution,
  };
}

function forwardLines(exposure: Exposure, assumptions: MarketAssumptions): ReturnLine[] {
  if (exposure.kind === 'cash') {
    return [{
      label: 'Euro short rate',
      annualPercent: assumptions.eurCashPercent,
      note: 'A starting point for overnight cash, not a rate locked for the whole horizon.',
    }];
  }
  if (exposure.kind === 'bond' && exposure.realPremium != null) {
    return [
      {
        label: 'Real yield',
        annualPercent: exposure.realPremium,
        note: 'Yield above inflation. Past swings in real yields are not repeated.',
      },
      {
        label: 'Euro inflation',
        annualPercent: assumptions.inflationPercent,
        note: 'Added because a linker pays inflation on top of the real yield.',
      },
    ];
  }
  if (exposure.kind === 'bond') {
    const lines: ReturnLine[] = [{
      label: 'Yield',
      annualPercent: exposure.yieldPercent ?? 0,
      note: 'Yield to maturity. The planning rate does not replay price gains from falling rates.',
    }];
    if ((exposure.creditLossPercent ?? 0) !== 0) {
      lines.push({
        label: 'Credit loss',
        annualPercent: -(exposure.creditLossPercent ?? 0),
        note: 'A haircut for downgrades and defaults.',
      });
    }
    return lines;
  }
  if (exposure.kind === 'gold' || exposure.kind === 'commodity' || exposure.kind === 'crypto') {
    const lines: ReturnLine[] = [{
      label: 'Euro inflation',
      annualPercent: assumptions.inflationPercent,
      note: exposure.kind === 'gold'
        ? 'Gold has no earnings. Inflation is the whole forward build.'
        : 'No cash yield. Inflation is the forward build, before fees.',
    }];
    if ((exposure.realPremium ?? 0) !== 0) {
      lines.push({
        label: 'Real premium',
        annualPercent: exposure.realPremium ?? 0,
        note: 'Added on top of inflation.',
      });
    }
    return lines;
  }
  const valuation = valuationAnnualPercent(exposure.valuation ?? 1, assumptions.horizonYears);
  return [
    {
      label: 'Dividend yield',
      annualPercent: exposure.dividendYield ?? 0,
      note: 'Cash dividends, around October 2026, rounded.',
    },
    {
      label: 'Net buybacks',
      annualPercent: exposure.netBuybackYield ?? 0,
      note: 'Buybacks minus issuance.',
    },
    {
      label: 'Real growth',
      annualPercent: exposure.realGrowth ?? 0,
      note: 'Real earnings growth over a long horizon, not last year’s pace.',
    },
    {
      label: 'Euro inflation',
      annualPercent: assumptions.inflationPercent,
      note: 'Turns the real build into a euro nominal return. Exchange rates are not given a drift.',
    },
    {
      label: 'Valuation change',
      annualPercent: valuation,
      note: `Prices are assumed to move to ${exposure.valuation ?? 1} times today’s level over ${assumptions.horizonYears} years.`,
    },
  ];
}

function inceptionYear(inception: string): number | null {
  const match = inception.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function estimateEtf(product: EtfProduct, rawAssumptions: MarketAssumptions = DEFAULT_ASSUMPTIONS): EtfEstimate {
  const assumptions = sanitizeAssumptions(rawAssumptions);
  const outlook = outlookFor(product.exposureId, assumptions, []);
  const hedge = product.hedgedToEur ? hedgeCostPercent(outlook.hedgeBucket, assumptions) : 0;
  const gross = outlook.forwardPercent;
  const underlyingForward = gross - hedge;
  const bridge = leverageBridge(
    underlyingForward,
    product.leverage,
    outlook.volatility,
    assumptions.financingPercent,
    product.terPercent,
  );
  const lines = productLines(product, outlook, assumptions, hedge, bridge);
  const forwardPercent = sumLines(lines);

  let historyPercent: number | null = null;
  if (outlook.historyPercent != null) {
    const historyBridge = leverageBridge(
      outlook.historyPercent - hedge,
      product.leverage,
      outlook.volatility,
      assumptions.historyFinancingPercent,
      product.terPercent,
    );
    historyPercent = historyBridge.total;
  }
  const historyWeight = historyBlendWeight(outlook.kind, outlook.historyYears, historyPercent != null);
  const planningPercent = historyWeight * (historyPercent ?? 0) + (1 - historyWeight) * forwardPercent;

  const cautions: string[] = [];
  if (outlook.caution) cautions.push(outlook.caution);
  if (product.leverage > 1) {
    cautions.push('This product resets its leverage every day. Financing and volatility drag are already in the rate. The prospectus still describes a one-day holding period, so a multi-decade savings plan sits outside the design.');
  } else if (product.leverage < 0) {
    cautions.push('This is a short product. It is built to rise when the market falls, which is a poor fit for a retirement savings plan.');
  }
  const launched = inceptionYear(product.inception);
  if (launched != null && launched >= 2023) {
    cautions.push(`The share class dates from ${product.inception}. A short life of its own is not used as the long-term history.`);
  }
  if (product.terEstimated) {
    cautions.push('The fee is a typical figure for this kind of fund, not the number from its prospectus.');
  }
  if (/russia/i.test(product.name)) {
    cautions.push('Trading in Russian securities has been restricted. The estimate ignores that and is not a reason to buy it.');
  }
  if (historyWeight === 0 && outlook.kind === 'equity') {
    cautions.push('No long euro history is attached to this market, so the planning rate is the forward estimate only.');
  }

  return {
    isin: product.isin,
    name: product.name,
    shortName: product.shortName,
    exposureId: product.exposureId,
    exposureLabel: outlook.label,
    kind: outlook.kind,
    leverage: product.leverage,
    hedgedToEur: product.hedgedToEur,
    hedgeCostPercent: hedge,
    terPercent: product.terPercent,
    terEstimated: product.terEstimated,
    historyPercent,
    historyYears: outlook.historyYears,
    historyLabel: outlook.historyLabel,
    historyWeight,
    recent: outlook.recent,
    forwardPercent,
    lines,
    indexLines: product.leverage === 1 ? [] : outlook.lines,
    planningPercent,
    cautions,
    blendsHistory: historyWeight > 0,
  };
}

function productLines(
  product: EtfProduct,
  outlook: Outlook,
  assumptions: MarketAssumptions,
  hedge: number,
  bridge: { decay: number; financing: number },
): ReturnLine[] {
  if (product.leverage === 1) {
    const lines = [...outlook.lines];
    if (hedge !== 0) {
      lines.push({
        label: 'Currency hedge',
        annualPercent: -hedge,
        note: 'Interest-rate gap for hedging back to euro. It moves when dollar and euro cash rates move.',
      });
    }
    lines.push({
      label: 'Fund fee',
      annualPercent: -product.terPercent,
      note: product.terEstimated ? 'Estimated fee, subtracted every year.' : 'TER, subtracted every year.',
    });
    return lines;
  }
  const multiple = product.leverage;
  const lines: ReturnLine[] = [{
    label: `Index expectation × ${multiple}`,
    annualPercent: multiple * outlook.forwardPercent,
    note: 'The 1× forward return, multiplied by the daily leverage.',
  }];
  if (hedge !== 0) {
    lines.push({
      label: `Currency hedge × ${multiple}`,
      annualPercent: -multiple * hedge,
      note: 'The hedge cost is levered with the index.',
    });
  }
  lines.push({
    label: 'Volatility drag',
    annualPercent: -bridge.decay,
    note: 'A daily reset loses ground when the path is choppy. Drag is about ½ × L × (L − 1) × variance.',
  });
  lines.push({
    label: 'Financing',
    annualPercent: -bridge.financing,
    note: multiple > 1
      ? `Cost of the extra exposure at ${assumptions.financingPercent.toLocaleString('de-DE')}% a year.`
      : `Cash earned on the short, after a ${SHORT_BORROW.toLocaleString('de-DE')} point borrow fee.`,
  });
  lines.push({
    label: 'Fund fee',
    annualPercent: -product.terPercent,
    note: 'TER on the note, subtracted once, not multiplied by the leverage.',
  });
  return lines;
}

export function planningRatePercent(estimate: EtfEstimate): number {
  return roundPercent(estimate.planningPercent);
}
