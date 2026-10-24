import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from './assumptions';
import { etfProducts, requireEtf } from './catalog';
import { listEtfs, type ListedEtf } from './list';

const assumptions = DEFAULT_ASSUMPTIONS;

function names(rows: ListedEtf[]): string[] {
  return rows.map((row) => row.product.isin);
}

describe('listEtfs', () => {
  const sample = [
    requireEtf('FR0014010HV4'),
    requireEtf('IE00BM67HM91'),
    requireEtf('IE000ROSD5J6'),
    requireEtf('LU1861132840'),
    requireEtf('DE000A0S9GB0'),
  ];

  it('keeps the example order when nothing is filtering', () => {
    const listed = listEtfs({
      products: etfProducts,
      assumptions,
      query: '',
      group: 'all',
      income: 'any',
      listing: 'any',
      history: 'any',
      sort: 'name',
      example: sample,
    });
    expect(listed.showingExample).toBe(true);
    expect(names(listed.rows)).toEqual(sample.map((product) => product.isin));
  });

  it('sorts by planning return, highest first', () => {
    const listed = listEtfs({
      products: sample,
      assumptions,
      query: '',
      group: 'equity',
      income: 'any',
      listing: 'any',
      history: 'any',
      sort: 'planning-desc',
      example: sample,
    });
    const rates = listed.rows.map((row) => row.planning);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(listed.rows[0].planning).toBeGreaterThan(listed.rows[listed.rows.length - 1].planning);
  });

  it('sorts by history and leaves funds without a long history at the end', () => {
    const high = listEtfs({
      products: sample,
      assumptions,
      query: ' ',
      group: 'all',
      income: 'any',
      listing: 'any',
      history: 'any',
      sort: 'history-desc',
      example: sample,
    });
    const histories = high.rows.map((row) => row.history);
    const known = histories.filter((value): value is number => value != null);
    expect(known).toEqual([...known].sort((a, b) => b - a));
    expect(histories.at(-1)).toBeNull();

    const low = listEtfs({
      products: sample,
      assumptions,
      query: 'a',
      group: 'all',
      income: 'any',
      listing: 'any',
      history: 'any',
      sort: 'history-asc',
      example: sample,
    });
    const ascending = low.rows.map((row) => row.history).filter((value): value is number => value != null);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    expect(low.rows.at(-1)?.history).toBeNull();
  });

  it('filters accumulating zero-fee funds that have a long history', () => {
    const listed = listEtfs({
      products: etfProducts,
      assumptions,
      query: '',
      group: 'equity',
      income: 'accumulating',
      listing: 'free',
      history: 'long',
      sort: 'planning-desc',
      example: [],
    });
    expect(listed.matched).toBeGreaterThan(10);
    for (const row of listed.rows) {
      expect(row.product.distribution).toBe('accumulating');
      expect(row.product.freeSparplan).toBe(true);
      expect(row.history).not.toBeNull();
    }
    const rates = listed.rows.map((row) => row.planning);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });
});
