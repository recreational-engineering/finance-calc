import { useEffect, useMemo, useState } from 'react';
import {
  ChartCard,
  StackedAreaChart,
  chartTicks,
  type MoneyPoint,
} from '../../components/Charts';
import {
  DateField,
  Facts,
  FieldGroup,
  NumberField,
  SettingsPanel,
  StatusLine,
  Warnings,
} from '../../components/Fields';
import { calendarToday, dayLabel, formatEur, formatPercentPoints, formatShare, monthLabel } from '../../platform/format';
import { seriesColor } from '../../platform/palette';
import { useStoredState } from '../../platform/storage';
import {
  ASSUMPTIONS_KEY,
  DEFAULT_ASSUMPTIONS,
  reviveAssumptions,
  type MarketAssumptions,
} from '../etf-returns/assumptions';
import { etfByIsin } from '../etf-returns/catalog';
import { EtfSearch } from '../etf-returns/EtfSearch';
import { estimateEtf, planningRatePercent } from '../etf-returns/model';
import {
  DEFAULT_RETIREMENT,
  actualRetirement,
  buyingPower,
  compoundedBalance,
  contributionBuyingPower,
  reviveRetirement,
  simulateRetirement,
  type ActualPath,
  type PriceBook,
  type RetirementResult,
  type SavingsEntry,
} from './model';
import { loadPriceBook } from './prices';

const MARKET_KEY = 'marketTotal';
const BUYING_POWER_KEY = 'buyingPower';
const INFLATION_KEY = 'inflationOnly';
const BUYING_POWER_COLOR = '#8ec5ff';
const INFLATION_COLOR = '#cfcfcf';

export function RetirementTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v3:retirement',
    DEFAULT_RETIREMENT,
    reviveRetirement,
  );
  const [assumptions, setAssumptions] = useStoredState(ASSUMPTIONS_KEY, DEFAULT_ASSUMPTIONS, reviveAssumptions);
  const [share, setShare] = useState(false);
  const [range, setRange] = useState<'horizon' | 'since'>('horizon');
  const [book, setBook] = useState<PriceBook | null>(null);
  const [priceError, setPriceError] = useState(false);
  const today = useMemo(() => calendarToday(), []);
  const result = useMemo(() => simulateRetirement(input), [input]);
  const actual = useMemo(
    () => (book ? actualRetirement(input, book, today) : null),
    [book, input, today],
  );

  useEffect(() => {
    let cancelled = false;
    loadPriceBook().then(
      (loaded) => {
        if (!cancelled) setBook(loaded);
      },
      () => {
        if (!cancelled) setPriceError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const inflation =
    Number.isFinite(assumptions.inflationPercent) && assumptions.inflationPercent > -100
      ? assumptions.inflationPercent
      : null;
  const monthlySavings = result.entries.reduce((sum, entry) => sum + entry.monthlyPayment, 0);
  const horizonMonth = result.points[result.points.length - 1]?.month ?? 0;
  const power = inflation == null ? null : buyingPower(result.total, inflation, horizonMonth);
  const inflationOnly = inflation == null ? null : compoundedBalance(monthlySavings, inflation, horizonMonth);
  const depositedPower = inflation == null ? null : contributionBuyingPower(monthlySavings, inflation, horizonMonth);
  const chartData = useMemo(
    () => buildChartData(result, actual, inflation),
    [result, actual, inflation],
  );
  const since = range === 'since' && actual?.hasMarket === true;
  const visible = useMemo(
    () => (since && actual ? chartData.filter((point) => point.month <= actual.elapsed + 1e-6) : chartData),
    [actual, chartData, since],
  );
  const endLabel = result.points[result.points.length - 1]?.label ?? '';
  const ticks = since && actual ? sinceTicks(actual.elapsed) : chartTicks(result.points[result.points.length - 1]?.month ?? 0);
  const notes = [
    ...result.warnings,
    ...leverageNotes(input.entries, assumptions),
    ...(actual?.warnings ?? []),
    ...(priceError ? ['Market prices did not load. The chart shows the estimate only.'] : []),
    ...(inflation == null ? ['Set an inflation rate above −100%.'] : []),
  ];

  const patchEntry = (id: string, patch: Partial<SavingsEntry>) => {
    setInput((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  };

  return (
    <article className="workspace">
      <SettingsPanel>
        <FieldGroup title="Horizon">
          <DateField
            label="Start date"
            value={input.startDate}
            onChange={(startDate) => setInput((current) => ({ ...current, startDate }))}
          />
          <NumberField
            label="Years"
            value={input.years}
            min={1}
            max={80}
            step={1}
            unit="years"
            onChange={(years) => setInput((current) => ({ ...current, years }))}
          />
          <NumberField
            label="Inflation"
            value={assumptions.inflationPercent}
            step={0.1}
            unit="%"
            hint="Constant euro inflation, shared with the ETF page."
            onChange={(inflationPercent) =>
              setAssumptions((current) => ({ ...current, inflationPercent }))
            }
          />
        </FieldGroup>
        <section className="setting-group">
          <h3>Entries</h3>
          {input.entries.map((entry, index) => (
            <div className="entry-block" key={entry.id}>
              <div className="entry-head">
                <i className="swatch" style={{ background: seriesColor(index) }} />
                <input
                  aria-label={`Name of entry ${index + 1}`}
                  value={entry.name}
                  onChange={(event) => patchEntry(entry.id, { name: event.target.value })}
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      entries: current.entries.filter((item) => item.id !== entry.id),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <EtfSearch
                id={`etf-${entry.id}`}
                assumptions={assumptions}
                selectedIsin={entry.isin}
                onPick={(product) =>
                  patchEntry(entry.id, {
                    isin: product.isin,
                    name: product.shortName,
                    yearlyInterestPercent: planningRatePercent(estimateEtf(product, assumptions)),
                  })
                }
              />
              <NumberField
                label="Monthly amount"
                value={entry.monthlyPayment}
                min={0}
                step={25}
                unit="€"
                onChange={(monthlyPayment) => patchEntry(entry.id, { monthlyPayment })}
              />
              <NumberField
                label="Yearly interest"
                value={entry.yearlyInterestPercent}
                min={-99}
                step={0.01}
                unit="%"
                onChange={(yearlyInterestPercent) => patchEntry(entry.id, { yearlyInterestPercent })}
              />
              <LinkedRate
                isin={entry.isin}
                assumptions={assumptions}
                yearlyInterestPercent={entry.yearlyInterestPercent}
                onApply={(yearlyInterestPercent) => patchEntry(entry.id, { yearlyInterestPercent })}
              />
            </div>
          ))}
          <button
            type="button"
            className="add-row"
            onClick={() =>
              setInput((current) => ({
                ...current,
                entries: [
                  ...current.entries,
                  {
                    id: crypto.randomUUID(),
                    name: 'New entry',
                    monthlyPayment: 200,
                    yearlyInterestPercent: 5,
                  },
                ],
              }))
            }
          >
            Add entry
          </button>
        </section>
        <div className="row-actions">
          <button type="button" className="secondary" onClick={reset}>
            Reset example
          </button>
        </div>
      </SettingsPanel>
      <section className="results">
        <Warnings items={notes} />
        <div className="verdict tone-left">
          <StatusLine warnings={notes} />
          <h2>{formatEur(result.total)} after {endLabel || 'the horizon'}</h2>
          <p>
            {formatEur(result.totalContributed)} paid in, and{' '}
            {formatEur(result.total - result.totalContributed)} from growth. A deposit earns
            interest from the next month.
          </p>
          {power != null && depositedPower != null ? (
            <p>
              In euros of {monthLabel(input.startDate, 0)} that estimate buys {formatEur(power)}. {formatEur(result.total - power)} of
              the headline figure is inflation. Buying power above the deposits is {formatEur(power - depositedPower)}.
            </p>
          ) : null}
          {actual?.hasMarket ? (
            <p>
              Through {dayLabel(actual.asOf)} those deposits are worth {formatEur(actual.total, 2)} at market
              prices. The estimate for that day is {formatEur(actual.predictedTotal, 2)}. {formatEur(actual.contributed, 2)} has
              been paid in.
              {inflation != null
                ? ` In euros of ${monthLabel(input.startDate, 0)} the market value buys ${formatEur(buyingPower(actual.total, inflation, actual.elapsed), 2)}.`
                : ''}
            </p>
          ) : null}
        </div>
        <ChartCard
          title={share ? 'Share of capital' : since ? 'Since the start' : 'Capital by entry'}
          caption={chartCaption(since, share, actual, book, priceError, input.startDate, today, inflation)}
          action={
            <div className="chart-actions">
              {actual?.hasMarket ? (
                <div className="toggle" role="group" aria-label="Chart range">
                  <button type="button" aria-pressed={range === 'since'} onClick={() => setRange('since')}>
                    Since start
                  </button>
                  <button type="button" aria-pressed={range === 'horizon'} onClick={() => setRange('horizon')}>
                    Horizon
                  </button>
                </div>
              ) : null}
              <div className="toggle" role="group" aria-label="Chart units">
                <button type="button" aria-pressed={!share} onClick={() => setShare(false)}>
                  Euro
                </button>
                <button type="button" aria-pressed={share} onClick={() => setShare(true)}>
                  Share
                </button>
              </div>
            </div>
          }
        >
          {visible.length > 1 ? (
            <StackedAreaChart
              data={visible}
              ticks={ticks}
              share={share && result.total > 0}
              showAllTicks={since && ticks.length <= 8}
              formatTick={
                since && actual
                  ? (month) => sinceTickLabel(month, input.startDate, actual)
                  : undefined
              }
              markMonth={!share && actual?.hasMarket && !since ? actual.elapsed : undefined}
              overlays={[
                ...(!share && actual?.hasMarket
                  ? [{ key: MARKET_KEY, name: 'Market', color: '#f4f4f4', width: 2.25 }]
                  : []),
                ...(!share && inflation != null
                  ? [
                      { key: BUYING_POWER_KEY, name: 'Buying power', color: BUYING_POWER_COLOR, width: 2.25 },
                      { key: INFLATION_KEY, name: 'Inflation', color: INFLATION_COLOR, width: 1.75, dash: '5 4' },
                    ]
                  : []),
              ]}
              series={result.entries.map((entry) => ({
                key: entry.id,
                name: entry.name,
                color: seriesColor(entry.colorIndex),
              }))}
            />
          ) : (
            <p className="empty">Add a horizon to draw the plan.</p>
          )}
        </ChartCard>
        {actual?.hasMarket ? <ToDateTable result={result} actual={actual} /> : null}
        <ul className="legend">
          {result.entries.map((entry) => (
            <li key={entry.id}>
              <i style={{ background: seriesColor(entry.colorIndex) }} />
              <span>{entry.name}</span>
            </li>
          ))}
          {power != null ? (
            <li>
              <i style={{ background: BUYING_POWER_COLOR }} />
              <span>Buying power</span>
              <b>{formatEur(power)}</b>
              <span>in {monthLabel(input.startDate, 0)} euros</span>
            </li>
          ) : null}
          {inflationOnly != null ? (
            <li>
              <i style={{ background: INFLATION_COLOR }} />
              <span>Inflation only</span>
              <b>{formatEur(inflationOnly)}</b>
            </li>
          ) : null}
        </ul>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Final capital by savings entry</caption>
            <thead>
              <tr>
                <th scope="col">Entry</th>
                <th scope="col">Monthly</th>
                <th scope="col">Interest</th>
                <th scope="col">Paid in</th>
                <th scope="col">Growth</th>
                <th scope="col">Capital</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">{entry.name}</th>
                  <td>{formatEur(entry.monthlyPayment)}</td>
                  <td>{formatPercentPoints(entry.yearlyInterestPercent, 2)}</td>
                  <td>{formatEur(entry.contributed)}</td>
                  <td>{formatEur(entry.growth)}</td>
                  <td>{formatEur(entry.capital)}</td>
                  <td>{formatShare(entry.fraction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="method">
          <summary>Yearly balances</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {result.entries.map((entry) => (
                    <th scope="col" key={entry.id}>
                      {entry.name}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                  {inflation != null ? <th scope="col">Buying power</th> : null}
                  {inflation != null ? <th scope="col">Inflation</th> : null}
                  {actual?.hasMarket ? <th scope="col">Market</th> : null}
                </tr>
              </thead>
              <tbody>
                {result.points
                  .filter((point) => point.month % 12 === 0)
                  .map((point) => (
                    <tr key={point.month}>
                      <th scope="row">{point.label}</th>
                      {result.entries.map((entry) => (
                        <td key={entry.id}>{formatEur(point.values[entry.id] ?? 0)}</td>
                      ))}
                      <td>{formatEur(point.total)}</td>
                      {inflation != null ? (
                        <td>{formatEur(chartPoint(chartData, point.month, BUYING_POWER_KEY))}</td>
                      ) : null}
                      {inflation != null ? (
                        <td>{formatEur(chartPoint(chartData, point.month, INFLATION_KEY))}</td>
                      ) : null}
                      {actual?.hasMarket ? (
                        <td>
                          {point.month <= actual.elapsed + 1e-9
                            ? formatEur(actual.points.find((item) => item.month === point.month)?.total ?? Number.NaN)
                            : '—'}
                        </td>
                      ) : null}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
        <Facts
          items={[
            { label: 'Entries', value: String(result.entries.length) },
            { label: 'Paid in', value: formatEur(result.totalContributed) },
            { label: 'Growth', value: formatEur(result.total - result.totalContributed) },
            ...(power != null && depositedPower != null
              ? [
                  { label: 'Buying power', value: formatEur(power) },
                  { label: 'Real gain', value: formatEur(power - depositedPower) },
                ]
              : []),
            ...(actual?.hasMarket
              ? [
                  { label: 'Market to date', value: formatEur(actual.total, 2) },
                  { label: 'Estimated to date', value: formatEur(actual.predictedTotal, 2) },
                ]
              : []),
          ]}
        />
      </section>
    </article>
  );
}

function buildChartData(
  result: RetirementResult,
  actual: ActualPath | null,
  inflation: number | null,
): MoneyPoint[] {
  const marketAt = new Map<number, number>();
  if (actual?.hasMarket) {
    for (const point of actual.points) marketAt.set(point.month, point.total);
  }
  const data: MoneyPoint[] = result.points.map((point) => {
    const within = actual?.hasMarket === true && point.month <= actual.elapsed + 1e-9;
    return {
      month: point.month,
      label: point.label,
      ...point.values,
      [MARKET_KEY]: within ? marketAt.get(point.month) ?? null : null,
    };
  });
  if (actual?.hasMarket) {
    const whole = Math.floor(actual.elapsed + 1e-9);
    if (actual.elapsed - whole > 1e-6) {
      const values: Record<string, number> = {};
      for (const entry of result.entries) {
        values[entry.id] = compoundedBalance(entry.monthlyPayment, entry.yearlyInterestPercent, actual.elapsed);
      }
      data.push({
        month: actual.elapsed,
        label: dayLabel(actual.asOf),
        ...values,
        [MARKET_KEY]: actual.total,
      });
      data.sort((left, right) => Number(left.month) - Number(right.month));
    }
  }
  if (inflation != null) {
    const monthly = result.entries.reduce((sum, entry) => sum + entry.monthlyPayment, 0);
    const ids = result.entries.map((entry) => entry.id);
    for (const point of data) {
      const month = Number(point.month);
      const nominal = ids.reduce((sum, id) => {
        const value = point[id];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      point[INFLATION_KEY] = compoundedBalance(monthly, inflation, month);
      point[BUYING_POWER_KEY] = buyingPower(nominal, inflation, month);
    }
  }
  return data;
}

function chartPoint(data: MoneyPoint[], month: number, key: string): number {
  const point = data.find((item) => item.month === month);
  const value = point?.[key];
  return typeof value === 'number' ? value : Number.NaN;
}

function sinceTicks(elapsed: number): number[] {
  if (elapsed <= 8) {
    const ticks = [0];
    const whole = Math.floor(elapsed + 1e-9);
    for (let month = 1; month <= whole; month += 1) ticks.push(month);
    if (elapsed - whole > 0.02) ticks.push(elapsed);
    return ticks;
  }
  return chartTicks(elapsed);
}

function sinceTickLabel(month: number, start: string, actual: ActualPath): string {
  if (Math.abs(month - actual.elapsed) < 1e-4 && Math.abs(actual.elapsed - Math.round(actual.elapsed)) > 1e-4) {
    return dayLabel(actual.asOf);
  }
  if (month === 0) return 'Start';
  return monthLabel(start, Math.round(month));
}

function chartCaption(
  since: boolean,
  share: boolean,
  actual: ActualPath | null,
  book: PriceBook | null,
  priceError: boolean,
  start: string,
  today: string,
  inflation: number | null,
): string {
  const prices = inflation == null
    ? ''
    : ` Dashed line: deposits earning only inflation. Blue line: buying power in euros of ${monthLabel(start, 0)}. Capital above the dashed line is a real gain.`;
  if (share) {
    return inflation == null
      ? 'Each coloured band is that entry’s share of the estimate.'
      : 'Each coloured band is that entry’s share of the estimate. Inflation is drawn on the euro chart.';
  }
  if (actual?.hasMarket) {
    const through = dayLabel(actual.asOf);
    const lead = since
      ? `Estimate and market value from the start through ${through}.`
      : `Coloured bands are the yearly interest. The white line is market prices through ${through}.`;
    return lead + prices;
  }
  if (!book && !priceError && start < today) return `Loading market prices…${prices}`;
  return `Each coloured band is one entry. The top of the stack is the total.${prices}`;
}

function ToDateTable({ result, actual }: { result: RetirementResult; actual: ActualPath }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Market value against the estimate through {dayLabel(actual.asOf)}</caption>
        <thead>
          <tr>
            <th scope="col">Through {dayLabel(actual.asOf)}</th>
            <th scope="col">Paid in</th>
            <th scope="col">Estimated</th>
            <th scope="col">Market</th>
            <th scope="col">Gap</th>
          </tr>
        </thead>
        <tbody>
          {result.entries.map((entry) => {
            const row = actual.entries.find((item) => item.id === entry.id);
            const market = row?.priced ? row.marketCapital : null;
            const estimated = row?.predictedCapital ?? 0;
            return (
              <tr key={entry.id}>
                <th scope="row">{entry.name}</th>
                <td>{formatEur(row?.contributed ?? 0, 2)}</td>
                <td>{formatEur(estimated, 2)}</td>
                <td>{market == null ? '—' : formatEur(market, 2)}</td>
                <td>{market == null ? '—' : formatEur(market - estimated, 2)}</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <th scope="row">Total</th>
            <td>{formatEur(actual.contributed, 2)}</td>
            <td>{formatEur(actual.predictedTotal, 2)}</td>
            <td>{formatEur(actual.total, 2)}</td>
            <td>{formatEur(actual.total - actual.predictedTotal, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function leverageNotes(entries: SavingsEntry[], assumptions: MarketAssumptions): string[] {
  return entries.flatMap((entry) => {
    if (!entry.isin) return [];
    const product = etfByIsin.get(entry.isin);
    if (!product || product.leverage === 1) return [];
    const caution = estimateEtf(product, assumptions).cautions.find(
      (item) => item.startsWith('This product') || item.startsWith('This is a short'),
    );
    return caution ? [`${entry.name}: ${caution}`] : [];
  });
}

function LinkedRate({
  isin,
  assumptions,
  yearlyInterestPercent,
  onApply,
}: {
  isin?: string;
  assumptions: MarketAssumptions;
  yearlyInterestPercent: number;
  onApply: (rate: number) => void;
}) {
  const product = isin ? etfByIsin.get(isin) : undefined;
  if (!product) return null;
  const estimate = estimateEtf(product, assumptions);
  const rate = planningRatePercent(estimate);
  const stale = Math.abs(yearlyInterestPercent - rate) > 0.009;
  const history = estimate.historyPercent;
  return (
    <p className="setting-note">
      {product.freeSparplan ? 'Zero-fee sparplan' : product.sparplan ? 'DKB sparplan' : 'DKB depot'}
      . History {history == null ? '—' : formatPercentPoints(history, 1)}, forward{' '}
      {formatPercentPoints(estimate.forwardPercent, 1)}.
      {stale ? (
        <>
          {' '}
          <button type="button" className="inline-link" onClick={() => onApply(rate)}>
            Use planning rate {formatPercentPoints(rate, 2)}
          </button>
        </>
      ) : null}
    </p>
  );
}
