import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from './assumptions';
import { etfProducts, requireEtf, searchEtfs } from './catalog';
import { classifyEtf } from './classify';
import { EXPOSURES } from './exposures';
import {
  estimateEtf,
  historyBlendWeight,
  leverageBridge,
  planningRatePercent,
  valuationAnnualPercent,
} from './model';

describe('leverageBridge', () => {
  it('subtracts only the fee when leverage is 1', () => {
    const bridge = leverageBridge(6, 1, 15, 4, 0.2);
    expect(bridge.decay).toBeCloseTo(0, 8);
    expect(bridge.financing).toBeCloseTo(0, 8);
    expect(bridge.total).toBeCloseTo(5.8, 8);
  });

  it('charges variance and financing on a daily 2× note', () => {
    // Drag = 0.5 × 2 × 1 × 0.15² = 2.25 points. Financing on the extra unit is 4.
    const bridge = leverageBridge(6, 2, 15, 4, 0.5);
    expect(bridge.decay).toBeCloseTo(2.25, 8);
    expect(bridge.financing).toBeCloseTo(4, 8);
    expect(bridge.total).toBeCloseTo(12 - 2.25 - 4 - 0.5, 8);
  });

  it('spreads a valuation gap over the horizon', () => {
    expect(valuationAnnualPercent(1, 30)).toBeCloseTo(0, 8);
    const drag = valuationAnnualPercent(0.82, 30);
    expect(drag).toBeLessThan(0);
    expect(drag).toBeGreaterThan(-1);
  });

  it('ignores a short history and ignores bond history entirely', () => {
    expect(historyBlendWeight('equity', 3, true)).toBe(0);
    expect(historyBlendWeight('equity', 26, true)).toBe(0.5);
    expect(historyBlendWeight('gold', 17, true)).toBe(0.4);
    expect(historyBlendWeight('bond', 30, true)).toBe(0);
    expect(historyBlendWeight('equity', 30, false)).toBe(0);
  });
});

describe('classifyEtf', () => {
  it('keeps sectors, leverage, and euro hedges apart', () => {
    expect(classifyEtf('Xtrackers MSCI World Energy UCITS ETF 1C', 'MSCI World Energy Index')).toMatchObject({
      exposureId: 'energy',
      leverage: 1,
      hedgedToEur: false,
    });
    expect(classifyEtf('Amundi MSCI World (2x) Leveraged UCITS ETF Acc')).toMatchObject({
      exposureId: 'world',
      leverage: 2,
    });
    expect(classifyEtf('Xtrackers LevDAX Daily Swap UCITS ETF 1C')).toMatchObject({
      exposureId: 'germany',
      leverage: 2,
    });
    expect(classifyEtf('Lyxor Bund-Future UCITS ETF', 'Solactive Bund Daily (1x) Leveraged Index')).toMatchObject({
      exposureId: 'euro-gov',
      leverage: 1,
    });
    expect(classifyEtf('Xtrackers ShortDAX x2 Daily Swap UCITS ETF 1C')).toMatchObject({
      exposureId: 'germany',
      leverage: -2,
    });
    expect(classifyEtf('Xtrackers II EUR Corporate Bond Short Duration SRI PAB UCITS ETF 1C')).toMatchObject({
      exposureId: 'euro-ig',
      leverage: 1,
    });
    expect(classifyEtf('Xtrackers II EUR Overnight Rate Swap UCITS ETF 1C')).toMatchObject({
      exposureId: 'cash',
      leverage: 1,
    });
    expect(classifyEtf('Xtrackers MSCI World UCITS ETF 2C - EUR Hedged')).toMatchObject({
      exposureId: 'world',
      hedgedToEur: true,
    });
    expect(classifyEtf('iShares Core S&P 500 UCITS ETF USD (Acc)')).toMatchObject({
      exposureId: 'usa',
      hedgedToEur: false,
    });
    expect(classifyEtf('iShares Essential Metals Producers UCITS ETF USD (Acc)')).toMatchObject({
      exposureId: 'metals',
    });
    expect(classifyEtf('Xetra-Gold ETC')).toMatchObject({ exposureId: 'gold', leverage: 1 });
    expect(classifyEtf('Amundi MSCI Robotics & AI UCITS ETF Acc')).toMatchObject({
      exposureId: 'robotics',
    });
    expect(classifyEtf('Vanguard FTSE All-World UCITS ETF USD Accumulating')).toMatchObject({
      exposureId: 'acwi',
    });
  });
});

describe('estimateEtf', () => {
  const world = requireEtf('IE00B4L5Y983');
  const leveraged = requireEtf('FR0014010HV4');
  const energy = requireEtf('IE00BM67HM91');
  const metals = requireEtf('IE000ROSD5J6');
  const robotics = requireEtf('LU1861132840');
  const gold = requireEtf('DE000A0S9GB0');

  it('makes the forward lines add up, and blends them with history', () => {
    for (const product of [world, leveraged, energy, metals, robotics, gold]) {
      const estimate = estimateEtf(product);
      const summed = estimate.lines.reduce((total, line) => total + line.annualPercent, 0);
      expect(summed).toBeCloseTo(estimate.forwardPercent, 6);
      const weight = estimate.historyWeight;
      const expected = weight * (estimate.historyPercent ?? 0) + (1 - weight) * estimate.forwardPercent;
      expect(estimate.planningPercent).toBeCloseTo(expected, 6);
    }
  });

  it('does not turn a 2× world note into twice the world return', () => {
    const plain = estimateEtf(world);
    const levered = estimateEtf(leveraged);
    expect(levered.leverage).toBe(2);
    expect(levered.forwardPercent).toBeLessThan(plain.forwardPercent + 2);
    expect(levered.planningPercent).toBeLessThan(plain.planningPercent + 4);
    expect(levered.planningPercent).toBeGreaterThan(0);
    expect(levered.cautions.some((item) => item.includes('one-day'))).toBe(true);
  });

  it('cuts the leveraged forward when financing rises', () => {
    const cheap = estimateEtf(leveraged, { ...DEFAULT_ASSUMPTIONS, financingPercent: 1 });
    const dear = estimateEtf(leveraged, { ...DEFAULT_ASSUMPTIONS, financingPercent: 6 });
    expect(dear.forwardPercent).toBeLessThan(cheap.forwardPercent - 4);
  });

  it('adds inflation to equities and gold, and not to a bond yield', () => {
    const low = { ...DEFAULT_ASSUMPTIONS, inflationPercent: 2 };
    const high = { ...DEFAULT_ASSUMPTIONS, inflationPercent: 3 };
    expect(estimateEtf(world, high).forwardPercent - estimateEtf(world, low).forwardPercent).toBeCloseTo(1, 6);
    expect(estimateEtf(gold, high).forwardPercent - estimateEtf(gold, low).forwardPercent).toBeCloseTo(1, 6);
    const bond = etfProducts.find((product) => product.exposureId === 'euro-gov');
    expect(bond).toBeTruthy();
    if (!bond) return;
    expect(estimateEtf(bond, high).forwardPercent).toBeCloseTo(estimateEtf(bond, low).forwardPercent, 6);
    expect(estimateEtf(bond).historyWeight).toBe(0);
  });

  it('keeps gold and the young metals fund below their exciting recent windows', () => {
    const goldEstimate = estimateEtf(gold);
    expect(goldEstimate.historyPercent).not.toBeNull();
    expect(goldEstimate.planningPercent).toBeLessThan(goldEstimate.historyPercent ?? 0);
    expect(goldEstimate.planningPercent).toBeGreaterThan(2);
    expect(goldEstimate.planningPercent).toBeLessThan(8);

    const metalsEstimate = estimateEtf(metals);
    expect(metalsEstimate.historyWeight).toBe(0);
    expect(metalsEstimate.planningPercent).toBeCloseTo(metalsEstimate.forwardPercent, 6);
    expect(metalsEstimate.planningPercent).toBeLessThan(10);
    expect(metalsEstimate.planningPercent).toBeGreaterThan(0);
  });

  it('uses the long world history rather than the post-crash decade', () => {
    const estimate = estimateEtf(world);
    expect(estimate.historyYears).toBeGreaterThan(25);
    expect(estimate.recent?.annualPercent).toBeGreaterThan(estimate.historyPercent ?? 0);
    expect(estimate.historyWeight).toBe(0.5);
  });

  it('locks the default planning rates for the retirement portfolio', () => {
    const rates = {
      FR0014010HV4: planningRatePercent(estimateEtf(leveraged)),
      IE00BM67HM91: planningRatePercent(estimateEtf(energy)),
      IE000ROSD5J6: planningRatePercent(estimateEtf(metals)),
      LU1861132840: planningRatePercent(estimateEtf(robotics)),
      DE000A0S9GB0: planningRatePercent(estimateEtf(gold)),
    };
    expect(rates).toEqual({
      FR0014010HV4: 6.19,
      IE00BM67HM91: 6.8,
      IE000ROSD5J6: 4.5,
      LU1861132840: 6.53,
      DE000A0S9GB0: 4.68,
    });
  });
});

describe('etf catalog', () => {
  it('lists each ISIN once and only known markets', () => {
    const isins = etfProducts.map((product) => product.isin);
    expect(new Set(isins).size).toBe(isins.length);
    expect(isins.length).toBeGreaterThan(900);
    for (const product of etfProducts) {
      expect(EXPOSURES.has(product.exposureId)).toBe(true);
      expect(Number.isFinite(product.terPercent)).toBe(true);
    }
  });

  it('finds funds by ISIN, WKN, and name', () => {
    expect(searchEtfs(etfProducts, 'IE00BM67HM91')[0]?.isin).toBe('IE00BM67HM91');
    expect(searchEtfs(etfProducts, 'A113FF')[0]?.isin).toBe('IE00BM67HM91');
    expect(searchEtfs(etfProducts, 'robotics ai')[0]?.isin).toBe('LU1861132840');
  });

  it('leaves only genuinely odd names in the broad equity bucket', () => {
    const odd = etfProducts.filter((product) => product.exposureId === 'equity-other');
    expect(odd.map((product) => product.name).sort()).toEqual([]);
  });
});
