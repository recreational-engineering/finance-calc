import rawCatalog from './catalog.json';
import { classifyEtf } from './classify';
import { exposureById, type ExposureKind } from './exposures';

/**
 * DKB sparplan names and fees as published on etf.capital, fetched 24 Oct 2026,
 * plus three listings a DKB depot can trade that were missing from that snapshot:
 * Amundi MSCI World (2×), iShares Essential Metals Producers, and Xetra-Gold.
 * The zero-fee flag matches the WKN to DKB's 2026 action PDF (Amundi, DWS, SPDR).
 * Recent price changes are that site's Kursentwicklung and are not the planning input.
 */

export interface CatalogRecord {
  isin: string;
  wkn: string;
  name: string;
  ter: number | null;
  dist: string;
  inception: string;
  index: string;
  ccy: string;
  repl: string;
  ytd: number | null;
  r1: number | null;
  r3: number | null;
  r5: number | null;
  sparplan: boolean;
  free: boolean;
}

export type Distribution = 'accumulating' | 'distributing' | 'none';

export interface EtfProduct {
  isin: string;
  wkn: string;
  name: string;
  shortName: string;
  indexName: string;
  terPercent: number;
  terEstimated: boolean;
  distribution: Distribution;
  replication: string;
  currency: string;
  inception: string;
  exposureId: string;
  kind: ExposureKind;
  leverage: number;
  hedgedToEur: boolean;
  sparplan: boolean;
  /** In the DKB 2026 zero-fee sparplan action. */
  freeSparplan: boolean;
  priceChange: {
    ytd: number | null;
    year1: number | null;
    year3: number | null;
    year5: number | null;
  };
}

const records = rawCatalog as CatalogRecord[];

export function etfShortName(name: string): string {
  const stripped = name
    .replace(/\s+ucits etf\b.*$/i, '')
    .replace(/\s+etf\b.*$/i, '')
    .replace(/\s+etc\b.*$/i, '')
    .replace(/\s+-\s+\(usd\)\s+accumulating.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || name;
}

function distributionOf(value: string): Distribution {
  if (value === 'acc') return 'accumulating';
  if (value === 'dist') return 'distributing';
  return 'none';
}

function replicationOf(value: string): string {
  const text = value.toLowerCase();
  if (!text) return '';
  if (text.includes('synthe')) return 'Synthetic';
  if (text.includes('phys') || text.includes('physik') || text.includes('voll')) return 'Physical';
  if (text.includes('optim')) return 'Physical (sampled)';
  return value;
}

function fallbackTer(kind: ExposureKind): number {
  if (kind === 'bond' || kind === 'cash') return 0.2;
  if (kind === 'gold' || kind === 'commodity') return 0.3;
  if (kind === 'crypto') return 0.75;
  return 0.3;
}

function toProduct(record: CatalogRecord): EtfProduct {
  const classified = classifyEtf(record.name, record.index);
  const kind = exposureById(classified.exposureId).kind;
  const overrides = OVERRIDES[record.isin];
  const ter = overrides?.terPercent ?? record.ter;
  return {
    isin: record.isin,
    wkn: record.wkn,
    name: overrides?.name ?? record.name,
    shortName: etfShortName(overrides?.name ?? record.name),
    indexName: overrides?.indexName ?? record.index,
    terPercent: ter ?? fallbackTer(kind),
    terEstimated: ter == null,
    distribution: overrides?.distribution ?? distributionOf(record.dist),
    replication: overrides?.replication ?? replicationOf(record.repl),
    currency: overrides?.currency ?? (record.ccy || 'USD'),
    inception: overrides?.inception ?? record.inception,
    exposureId: classified.exposureId,
    kind,
    leverage: classified.leverage,
    hedgedToEur: classified.hedgedToEur,
    sparplan: record.sparplan,
    freeSparplan: record.free,
    priceChange: {
      ytd: record.ytd,
      year1: record.r1,
      year3: record.r3,
      year5: record.r5,
    },
  };
}

const OVERRIDES: Record<string, Partial<EtfProduct>> = {
  // Issuer inception is 30 Sep 2025. The comparison page's chart starts in Jan 2026.
  FR0014010HV4: { inception: 'Sep 2025' },
  // Quoted in euro per gram. The comparison page labels the currency as USD.
  DE000A0S9GB0: {
    currency: 'EUR',
    replication: 'Physical gold',
    distribution: 'none',
    indexName: 'Gold price, euro per gram',
  },
};

export const etfProducts: EtfProduct[] = records.map(toProduct);
export const etfByIsin: ReadonlyMap<string, EtfProduct> = new Map(etfProducts.map((product) => [product.isin, product]));

export function requireEtf(isin: string): EtfProduct {
  const product = etfByIsin.get(isin);
  if (!product) throw new Error(`ETF ${isin} is not in the DKB list`);
  return product;
}

export function searchEtfs(products: readonly EtfProduct[], query: string, limit = 12): EtfProduct[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);
  const scored: { product: EtfProduct; score: number }[] = [];
  for (const product of products) {
    const haystack = `${product.isin} ${product.wkn} ${product.name} ${product.indexName}`.toLowerCase();
    if (!tokens.every((token) => haystack.includes(token))) continue;
    let score = 0;
    if (product.isin.toLowerCase() === needle) score += 100;
    if (product.wkn.toLowerCase() === needle) score += 90;
    if (product.name.toLowerCase().startsWith(needle)) score += 20;
    if (product.sparplan) score += 1;
    scored.push({ product, score });
  }
  scored.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  return scored.slice(0, limit).map((item) => item.product);
}

export const PORTFOLIO_ISINS = [
  'FR0014010HV4',
  'IE00BM67HM91',
  'IE000ROSD5J6',
  'LU1861132840',
  'DE000A0S9GB0',
] as const;
