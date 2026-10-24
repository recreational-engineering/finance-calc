import { useMemo, useState } from 'react';
import { Facts, FieldGroup, NumberField, StatusLine, Warnings } from '../../components/Fields';
import { formatPercentPoints, formatShare } from '../../platform/format';
import { useStoredState } from '../../platform/storage';
import {
  ASSUMPTIONS_KEY,
  DEFAULT_ASSUMPTIONS,
  reviveAssumptions,
  type MarketAssumptions,
} from './assumptions';
import {
  PORTFOLIO_ISINS,
  etfByIsin,
  etfProducts,
  requireEtf,
  searchEtfs,
  type EtfProduct,
} from './catalog';
import { estimateEtf, planningRatePercent, type EtfEstimate } from './model';

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'equity', label: 'Equities' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'real', label: 'Gold and commodities' },
  { id: 'levered', label: 'Leveraged' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

function inGroup(product: EtfProduct, group: GroupId): boolean {
  if (group === 'all') return true;
  if (group === 'levered') return product.leverage !== 1;
  if (group === 'bonds') return product.kind === 'bond' || product.kind === 'cash';
  if (group === 'real') return product.kind === 'gold' || product.kind === 'commodity' || product.kind === 'crypto';
  return product.kind === 'equity';
}

function availability(product: EtfProduct): string {
  if (product.freeSparplan) return 'DKB sparplan, in the 2026 zero-fee action';
  if (product.sparplan) return 'DKB sparplan, 1.50 € outside the zero-fee action';
  return 'Tradable in a DKB depot, not in the sparplan snapshot';
}

function distributionLabel(product: EtfProduct): string {
  if (product.distribution === 'accumulating') return 'Accumulating';
  if (product.distribution === 'distributing') return 'Distributing';
  return 'None';
}

function reviveSelection(value: unknown): { isin: string } | null {
  if (!value || typeof value !== 'object') return null;
  const isin = (value as { isin?: unknown }).isin;
  if (typeof isin !== 'string' || !etfByIsin.has(isin)) return null;
  return { isin };
}

export function EtfReturnTool() {
  const [assumptions, setAssumptions, resetAssumptions] = useStoredState(
    ASSUMPTIONS_KEY,
    DEFAULT_ASSUMPTIONS,
    reviveAssumptions,
  );
  const [selection, setSelection] = useStoredState(
    'klarwert:v1:etf-selected',
    { isin: 'FR0014010HV4' },
    reviveSelection,
  );
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupId>('all');

  const product = etfByIsin.get(selection.isin) ?? requireEtf('FR0014010HV4');
  const estimate = useMemo(() => estimateEtf(product, assumptions), [product, assumptions]);
  const listed = useMemo(() => {
    const pool = etfProducts.filter((item) => inGroup(item, group));
    if (query.trim()) return searchEtfs(pool, query, 30);
    if (group !== 'all') return pool.slice(0, 30);
    return [];
  }, [group, query]);
  const shortcuts = PORTFOLIO_ISINS.map((isin) => etfByIsin.get(isin)).filter((item): item is EtfProduct => Boolean(item));

  const patch = (partial: Partial<MarketAssumptions>) => {
    setAssumptions((current) => ({ ...current, ...partial }));
  };

  return (
    <article className="workspace">
      <section className="panel">
        <header className="panel-intro">
          <p className="panel-kicker">Parameters</p>
          <p>
            Pick an ETF or ETC from the DKB list. The planning rate mixes a long
            history with a forward build from dividends, growth, inflation, and
            today’s prices. Retirement uses that rate as the interest.
          </p>
        </header>
        <label className="field" htmlFor="etf-query">
          <span className="field-label">Search the DKB list</span>
          <span className="field-control">
            <input
              id="etf-query"
              value={query}
              placeholder="Name, ISIN, or WKN"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <div className="chip-row" role="group" aria-label="Filter">
          {GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={group === item.id}
              onClick={() => setGroup(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <ul className="etf-hits">
          {(query.trim() || group !== 'all' ? listed : shortcuts).map((item) => (
            <Hit
              key={item.isin}
              product={item}
              assumptions={assumptions}
              selected={item.isin === product.isin}
              onPick={(next) => setSelection({ isin: next.isin })}
            />
          ))}
          {query.trim() && listed.length === 0 ? <li className="etf-empty">Nothing in this filter matches.</li> : null}
        </ul>
        <p className="hint">
          {etfProducts.length} listings. {etfProducts.filter((item) => item.sparplan).length} are on the DKB
          sparplan snapshot, and three more are depot listings in the retirement example.
          {query.trim() || group !== 'all'
            ? ` Showing ${listed.length} of ${etfProducts.filter((item) => inGroup(item, group)).length}.`
            : ' The five rows are that example.'}
        </p>
        <details className="method">
          <summary>Market assumptions</summary>
          <FieldGroup title="October 2026 starting point">
            <NumberField
              label="Euro inflation"
              value={assumptions.inflationPercent}
              step={0.1}
              unit="%"
              onChange={(inflationPercent) => patch({ inflationPercent })}
            />
            <NumberField
              label="Valuation horizon"
              value={assumptions.horizonYears}
              min={5}
              max={60}
              step={1}
              unit="years"
              onChange={(horizonYears) => patch({ horizonYears })}
            />
            <NumberField
              label="Leverage financing"
              value={assumptions.financingPercent}
              step={0.1}
              unit="%"
              hint="SOFR was 3.90% on 22 Oct 2026. The extra 0.50 is a swap spread."
              onChange={(financingPercent) => patch({ financingPercent })}
            />
            <NumberField
              label="Financing in the history"
              value={assumptions.historyFinancingPercent}
              step={0.1}
              unit="%"
              onChange={(historyFinancingPercent) => patch({ historyFinancingPercent })}
            />
            <NumberField
              label="USD hedge cost"
              value={assumptions.usdHedgeCostPercent}
              step={0.01}
              unit="%"
              hint="Dollar cash minus euro cash. €STR was 2.44%."
              onChange={(usdHedgeCostPercent) => patch({ usdHedgeCostPercent })}
            />
            <NumberField
              label="Euro cash yield"
              value={assumptions.eurCashPercent}
              step={0.01}
              unit="%"
              onChange={(eurCashPercent) => patch({ eurCashPercent })}
            />
          </FieldGroup>
          <button type="button" className="secondary" onClick={resetAssumptions}>
            Reset assumptions
          </button>
        </details>
      </section>
      <EstimateView product={product} estimate={estimate} />
    </article>
  );
}

function Hit({
  product,
  assumptions,
  selected,
  onPick,
}: {
  product: EtfProduct;
  assumptions: MarketAssumptions;
  selected: boolean;
  onPick: (product: EtfProduct) => void;
}) {
  const rate = planningRatePercent(estimateEtf(product, assumptions));
  return (
    <li>
      <button type="button" aria-pressed={selected} onClick={() => onPick(product)}>
        <span>{product.shortName}</span>
        <small>
          {product.isin} · {formatPercentPoints(rate, 2)}
        </small>
      </button>
    </li>
  );
}

function EstimateView({ product, estimate }: { product: EtfProduct; estimate: EtfEstimate }) {
  const history = estimate.historyPercent;
  const priceRows = [
    ['2026 so far', product.priceChange.ytd],
    ['1 year', product.priceChange.year1],
    ['3 years, annualised', product.priceChange.year3],
    ['5 years, annualised', product.priceChange.year5],
  ].filter((row): row is [string, number] => typeof row[1] === 'number');

  return (
    <section className="results">
      <Warnings items={estimate.cautions} />
      <div className="verdict">
        <StatusLine warnings={estimate.cautions} />
        <h2>{formatPercentPoints(planningRatePercent(estimate), 2)} a year</h2>
        <p>
          Planning rate for {product.shortName}. Retirement inserts this number as the
          yearly interest.           It is a nominal euro return before German fund tax.
          {estimate.blendsHistory
            ? ` History has a ${formatShare(estimate.historyWeight)} weight. The rest is the forward build.`
            : ' The forward build is the whole rate.'}
        </p>
      </div>
      <dl className="stats">
        <div>
          <dt>History</dt>
          <dd>{history == null ? '—' : formatPercentPoints(history, 2)}</dd>
        </div>
        <div>
          <dt>Forward</dt>
          <dd>{formatPercentPoints(estimate.forwardPercent, 2)}</dd>
        </div>
        <div>
          <dt>Planning</dt>
          <dd>{formatPercentPoints(planningRatePercent(estimate), 2)}</dd>
        </div>
      </dl>
      {estimate.historyLabel ? <p className="hint lone-hint">{estimate.historyLabel}</p> : null}
      {estimate.recent ? (
        <p className="hint lone-hint">
          Shorter window, not used in the blend: {formatPercentPoints(estimate.recent.annualPercent, 1)} a year
          over {estimate.recent.years.toLocaleString('de-DE', { maximumFractionDigits: 0 })} years. {estimate.recent.label}
        </p>
      ) : null}
      <div className="table-wrap">
        <table className="breakdown">
          <caption className="sr-only">Lines that add up to the forward return</caption>
          <thead>
            <tr>
              <th scope="col">Forward build</th>
              <th scope="col">Per year</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lines.map((line) => (
              <tr key={line.label}>
                <th scope="row">
                  {line.label}
                  <span className="hint line-note">{line.note}</span>
                </th>
                <td>{formatPercentPoints(line.annualPercent, 2)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Forward return</th>
              <td>{formatPercentPoints(estimate.forwardPercent, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {estimate.indexLines.length > 0 ? (
        <details className="method">
          <summary>The 1× market underneath</summary>
          <div className="table-wrap">
            <table>
              <tbody>
                {estimate.indexLines.map((line) => (
                  <tr key={line.label}>
                    <th scope="row">{line.label}</th>
                    <td>{formatPercentPoints(line.annualPercent, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {priceRows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Recent price change, not used in the planning rate</caption>
            <thead>
              <tr>
                <th scope="col">Recent price change</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {priceRows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatPercentPoints(value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="hint lone-hint">
        Price changes are a data snapshot and skip dividends on distributing funds. They are not the planning rate.
      </p>
      <Facts
        items={[
          { label: 'ISIN', value: product.isin },
          { label: 'WKN', value: product.wkn || '—' },
          { label: 'Market', value: estimate.exposureLabel },
          { label: 'Index', value: product.indexName || '—' },
          { label: 'Fee', value: formatPercentPoints(product.terPercent, 2) },
          { label: 'Income', value: distributionLabel(product) },
          { label: 'Replication', value: product.replication || '—' },
          { label: 'Listed', value: product.inception || '—' },
          { label: 'At DKB', value: availability(product) },
        ]}
      />
      <details className="method">
        <summary>How the rate is built</summary>
        <div className="prose">
          <p>
            History is a long euro total return where one is on file: MSCI factsheets back to
            the end of 2000, or a fund’s own monthly prices when that series is the long one.
            A window that starts after 2008 is labelled and, when a longer one exists, kept out
            of the blend.
          </p>
          <p>
            The forward line for equities is dividend yield, net buybacks, real growth, euro
            inflation, and a valuation gap closed over the horizon. Below 1, the valuation ratio
            means today’s price is rich. Bonds use the yield, minus a credit haircut. Gold’s
            forward line is inflation only, because the metal has no earnings. The history of
            the gold price still pulls the blend up.
          </p>
          <p>
            A daily-reset multiple does not multiply the return. The bridge is leverage times
            the index, minus a variance drag of one-half L times (L − 1) times variance, minus
            financing on the borrowed part, minus the TER once. Past history is restated with
            the lower financing rate. The planning rate is half history once the window reaches
            25 years, 40% from 15 years, and 25% from 8 years. Shorter than that, or any bond,
            and the planning rate is the forward line alone.
          </p>
          <p>
            Figures are nominal, in euro, before Vorabpauschale and Abgeltungsteuer. This is a
            planning model, not a forecast and not a recommendation.
          </p>
        </div>
      </details>
    </section>
  );
}
