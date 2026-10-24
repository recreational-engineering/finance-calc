import { useEffect, useMemo, useState } from 'react';
import { ChartCard, GrowthCompareChart } from '../../components/Charts';
import { Facts, FieldGroup, NumberField, SettingsPanel, StatusLine, Warnings } from '../../components/Fields';
import { formatPercentPoints } from '../../platform/format';
import { useStoredState } from '../../platform/storage';
import {
  ASSUMPTIONS_KEY,
  DEFAULT_ASSUMPTIONS,
  reviveAssumptions,
  type MarketAssumptions,
} from './assumptions';
import { PORTFOLIO_ISINS, etfByIsin, etfProducts, requireEtf, type EtfProduct } from './catalog';
import {
  listEtfs,
  type EtfSort,
  type GroupId,
  type HistoryFilter,
  type IncomeFilter,
  type ListedEtf,
  type ListingFilter,
} from './list';
import { estimateEtf, growthComparison, planningRatePercent, type EtfEstimate } from './model';

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'equity', label: 'Equities' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'real', label: 'Gold' },
  { id: 'levered', label: 'Leveraged' },
];

const INCOME: Array<{ id: IncomeFilter; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'accumulating', label: 'Acc' },
  { id: 'distributing', label: 'Dist' },
];

const LISTING: Array<{ id: ListingFilter; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'sparplan', label: 'Sparplan' },
  { id: 'free', label: 'Zero-fee' },
];

const HISTORY: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'long', label: '8 years+' },
];

const SORTS: Array<{ id: EtfSort; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'planning-desc', label: 'Plan, high first' },
  { id: 'planning-asc', label: 'Plan, low first' },
  { id: 'history-desc', label: 'History, high first' },
  { id: 'history-asc', label: 'History, low first' },
];

const PAGE = 24;

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
  const [income, setIncome] = useState<IncomeFilter>('any');
  const [listing, setListing] = useState<ListingFilter>('any');
  const [history, setHistory] = useState<HistoryFilter>('any');
  const [sort, setSort] = useState<EtfSort>('name');
  const [visible, setVisible] = useState(PAGE);

  const product = etfByIsin.get(selection.isin) ?? requireEtf('FR0014010HV4');
  const estimate = useMemo(() => estimateEtf(product, assumptions), [product, assumptions]);
  const example = useMemo(
    () => PORTFOLIO_ISINS.map((isin) => etfByIsin.get(isin)).filter((item): item is EtfProduct => Boolean(item)),
    [],
  );
  const listed = useMemo(
    () =>
      listEtfs({
        products: etfProducts,
        assumptions,
        query,
        group,
        income,
        listing,
        history,
        sort,
        example,
      }),
    [assumptions, query, group, income, listing, history, sort, example],
  );
  const shown = listed.rows.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE);
  }, [query, group, income, listing, history, sort, assumptions]);

  const patch = (partial: Partial<MarketAssumptions>) => {
    setAssumptions((current) => ({ ...current, ...partial }));
  };

  return (
    <article className="workspace">
      <SettingsPanel>
        <section className="setting-group">
          <h3>Fund</h3>
          <label className="setting" htmlFor="etf-query">
            <span className="setting-copy">
              <span className="setting-label">Search</span>
              <span className="setting-hint">
                {listed.showingExample
                  ? 'Retirement example. Sort by a return to rank the list.'
                  : `${shown.length} of ${listed.matched}`}
              </span>
            </span>
            <span className="setting-control">
              <input
                id="etf-query"
                value={query}
                placeholder="Name, ISIN, or WKN"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>
          <Choice label="Asset class" options={GROUPS} value={group} onChange={setGroup} />
          <Choice label="Income" options={INCOME} value={income} onChange={setIncome} />
          <Choice label="Listing" options={LISTING} value={listing} onChange={setListing} />
          <Choice label="History" options={HISTORY} value={history} onChange={setHistory} />
          <label className="setting" htmlFor="etf-sort">
            <span className="setting-copy">
              <span className="setting-label">Sort</span>
            </span>
            <span className="setting-control">
              <select id="etf-sort" value={sort} onChange={(event) => setSort(event.target.value as EtfSort)}>
                {SORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className="setting-columns">
            <span>Fund</span>
            <span>Plan · history</span>
          </div>
          <ul className="etf-hits">
            {shown.map((row) => (
              <Hit
                key={row.product.isin}
                row={row}
                selected={row.product.isin === product.isin}
                onPick={(next) => setSelection({ isin: next.isin })}
              />
            ))}
            {shown.length === 0 ? <li className="etf-empty">Nothing in this filter matches.</li> : null}
          </ul>
          {listed.matched > shown.length ? (
            <button type="button" className="secondary show-more" onClick={() => setVisible((count) => count + PAGE)}>
              Show more
            </button>
          ) : null}
        </section>
        <FieldGroup title="Market assumptions" collapsed>
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
          <button type="button" className="secondary" onClick={resetAssumptions}>
            Reset assumptions
          </button>
        </FieldGroup>
      </SettingsPanel>
      <EstimateView product={product} estimate={estimate} />
    </article>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="asset-class">
      <span className="setting-label">{label}</span>
      <div className="segment" role="group" aria-label={label}>
        {options.map((item) => (
          <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hit({
  row,
  selected,
  onPick,
}: {
  row: ListedEtf;
  selected: boolean;
  onPick: (product: EtfProduct) => void;
}) {
  const { product, history, planning } = row;
  return (
    <li>
      <button type="button" aria-pressed={selected} onClick={() => onPick(product)}>
        <span className="hit-copy">
          <span>{product.shortName}</span>
          <small className="hit-isin">{product.isin}</small>
        </span>
        <span className="hit-rates">
          <small>{formatPercentPoints(planning, 2)}</small>
          <small>{history == null ? '—' : formatPercentPoints(history, 2)}</small>
        </span>
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
          Planning rate for {product.shortName}. Retirement uses it as the yearly interest.
          Nominal, in euro, before German fund tax.
          {estimate.blendsHistory
            ? ' It stays within 1,25 percentage points of the historic long-term rate.'
            : ' This fund has no long history on file, so the rate is the forward build.'}
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
      {history != null && estimate.historyYears >= 8 ? (
        <ChartCard
          title="Historic rate and estimate"
          caption={`€10,000 compounded over ${estimate.historyYears.toLocaleString('de-DE', { maximumFractionDigits: 1 })} years at the historic long-term rate and at the planning rate.`}
        >
          <GrowthCompareChart
            data={growthComparison(history, estimate.planningPercent, estimate.historyYears)}
          />
        </ChartCard>
      ) : (
        <p className="hint lone-hint">No long history is on file, so there is no historic curve to compare.</p>
      )}
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
            The planning rate is 85% that history and 15% the forward build, and it is not
            allowed to sit more than 1,25 percentage points away from the history.
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
            the lower financing rate. A history shorter than eight years is shown with the
            fund’s recent price changes and is not used as the long-term rate.
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
