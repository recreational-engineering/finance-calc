import type { MarketAssumptions } from './assumptions';
import { searchEtfs, type EtfProduct } from './catalog';
import { estimateEtf } from './model';

export type GroupId = 'all' | 'equity' | 'bonds' | 'real' | 'levered';
export type IncomeFilter = 'any' | 'accumulating' | 'distributing';
export type ListingFilter = 'any' | 'sparplan' | 'free';
export type HistoryFilter = 'any' | 'long';
export type EtfSort = 'name' | 'planning-desc' | 'planning-asc' | 'history-desc' | 'history-asc';

export interface ListedEtf {
  product: EtfProduct;
  history: number | null;
  planning: number;
}

export function inGroup(product: EtfProduct, group: GroupId): boolean {
  if (group === 'all') return true;
  if (group === 'levered') return product.leverage !== 1;
  if (group === 'bonds') return product.kind === 'bond' || product.kind === 'cash';
  if (group === 'real') return product.kind === 'gold' || product.kind === 'commodity' || product.kind === 'crypto';
  return product.kind === 'equity';
}

export function matchesIncome(product: EtfProduct, income: IncomeFilter): boolean {
  if (income === 'any') return true;
  return product.distribution === income;
}

export function matchesListing(product: EtfProduct, listing: ListingFilter): boolean {
  if (listing === 'sparplan') return product.sparplan;
  if (listing === 'free') return product.freeSparplan;
  return true;
}

function sortValue(row: ListedEtf, sort: EtfSort): number | null {
  if (sort.startsWith('history')) return row.history;
  return row.planning;
}

function compareRows(sort: EtfSort, left: ListedEtf, right: ListedEtf): number {
  if (sort === 'name') return left.product.name.localeCompare(right.product.name);
  const descending = sort.endsWith('desc');
  const a = sortValue(left, sort);
  const b = sortValue(right, sort);
  if (a == null && b == null) return left.product.name.localeCompare(right.product.name);
  if (a == null) return 1;
  if (b == null) return -1;
  const delta = descending ? b - a : a - b;
  if (delta !== 0) return delta;
  return left.product.name.localeCompare(right.product.name);
}

export function listEtfs(input: {
  products: readonly EtfProduct[];
  assumptions: MarketAssumptions;
  query: string;
  group: GroupId;
  income: IncomeFilter;
  listing: ListingFilter;
  history: HistoryFilter;
  sort: EtfSort;
  /** Shown when nothing is filtering and the sort is by name. */
  example: readonly EtfProduct[];
}): { rows: ListedEtf[]; matched: number; showingExample: boolean } {
  const filtered = input.products.filter(
    (product) =>
      inGroup(product, input.group) &&
      matchesIncome(product, input.income) &&
      matchesListing(product, input.listing),
  );
  const queried = input.query.trim() ? searchEtfs(filtered, input.query, filtered.length) : filtered;
  const ranked = queried.map((product) => {
    const estimate = estimateEtf(product, input.assumptions);
    return {
      product,
      history: estimate.historyPercent != null && estimate.historyYears >= 8 ? estimate.historyPercent : null,
      planning: estimate.planningPercent,
    };
  });
  const withHistory = input.history === 'long' ? ranked.filter((row) => row.history != null) : ranked;
  const showingExample =
    !input.query.trim() &&
    input.group === 'all' &&
    input.income === 'any' &&
    input.listing === 'any' &&
    input.history === 'any' &&
    input.sort === 'name';
  if (showingExample) {
    const byIsin = new Map(ranked.map((row) => [row.product.isin, row]));
    const rows = input.example.flatMap((product) => {
      const row = byIsin.get(product.isin);
      return row ? [row] : [];
    });
    return { rows, matched: rows.length, showingExample: true };
  }
  const rows = [...withHistory].sort((left, right) => compareRows(input.sort, left, right));
  return { rows, matched: rows.length, showingExample: false };
}
