import { useMemo, useState } from 'react';
import {
  ChartCard,
  StackedAreaChart,
  chartTicks,
  type MoneyPoint,
} from '../../components/Charts';
import { Facts, FieldGroup, NumberField, StatusLine, TextField, Warnings } from '../../components/Fields';
import { formatEur, formatPercentPoints, formatShare } from '../../platform/format';
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
  reviveRetirement,
  simulateRetirement,
  type SavingsEntry,
} from './model';

export function RetirementTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v2:retirement',
    DEFAULT_RETIREMENT,
    reviveRetirement,
  );
  const [assumptions] = useStoredState(ASSUMPTIONS_KEY, DEFAULT_ASSUMPTIONS, reviveAssumptions);
  const [share, setShare] = useState(false);
  const result = useMemo(() => simulateRetirement(input), [input]);

  const chartData: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    ...point.values,
  }));
  const lastMonth = result.points[result.points.length - 1]?.month ?? 0;
  const endLabel = result.points[result.points.length - 1]?.label ?? '';

  const patchEntry = (id: string, patch: Partial<SavingsEntry>) => {
    setInput((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  };

  return (
    <article className="workspace">
      <section className="panel">
        <header className="panel-intro">
          <p className="panel-kicker">Parameters</p>
          <p>
            Set the month the plan starts and how many years to run. Pick an ETF from the
            DKB list to fill the interest with its planning rate, or type a rate of your own.
            The areas are that entry’s capital.
          </p>
        </header>
        <FieldGroup title="Horizon">
          <label className="field">
            <span className="field-label">Start date</span>
            <span className="field-control">
              <input
                type="date"
                value={input.startDate}
                onChange={(event) =>
                  setInput((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </span>
          </label>
          <NumberField
            label="Years"
            value={input.years}
            min={1}
            max={80}
            step={1}
            unit="years"
            onChange={(years) => setInput((current) => ({ ...current, years }))}
          />
        </FieldGroup>
        <div className="entry-list">
          {input.entries.map((entry, index) => (
            <fieldset className="entry" key={entry.id}>
              <legend>
                <i className="swatch" style={{ background: seriesColor(index) }} />
                Entry {index + 1}
              </legend>
              <div className="fields">
                <EtfSearch
                  id={`etf-${entry.id}`}
                  assumptions={assumptions}
                  onPick={(product) =>
                    patchEntry(entry.id, {
                      isin: product.isin,
                      name: product.shortName,
                      yearlyInterestPercent: planningRatePercent(estimateEtf(product, assumptions)),
                    })
                  }
                />
                <LinkedRate
                  isin={entry.isin}
                  assumptions={assumptions}
                  yearlyInterestPercent={entry.yearlyInterestPercent}
                  onApply={(yearlyInterestPercent) => patchEntry(entry.id, { yearlyInterestPercent })}
                />
                <TextField
                  label="Name"
                  value={entry.name}
                  onChange={(name) => patchEntry(entry.id, { name })}
                />
                <NumberField
                  label="Paid in each month"
                  value={entry.monthlyPayment}
                  min={0}
                  step={25}
                  unit="€"
                  onChange={(monthlyPayment) => patchEntry(entry.id, { monthlyPayment })}
                />
                <NumberField
                  label="Expected yearly interest"
                  value={entry.yearlyInterestPercent}
                  min={-99}
                  step={0.01}
                  unit="%"
                  onChange={(yearlyInterestPercent) =>
                    patchEntry(entry.id, { yearlyInterestPercent })
                  }
                />
              </div>
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
                Remove entry
              </button>
            </fieldset>
          ))}
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="primary"
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
          <button type="button" className="secondary" onClick={reset}>
            Reset example
          </button>
        </div>
      </section>
      <section className="results">
        <Warnings items={[...result.warnings, ...leverageNotes(input.entries, assumptions)]} />
        <div className="verdict tone-left">
          <StatusLine warnings={result.warnings} />
          <h2>{formatEur(result.total)} after {endLabel || 'the horizon'}</h2>
          <p>
            {formatEur(result.totalContributed)} is money paid in. {formatEur(result.total - result.totalContributed)} is
            growth. Deposits land at the end of each month, so a payment earns interest from
            the month after. The yearly rate compounds monthly.
          </p>
        </div>
        <ChartCard
          title={share ? 'Share of capital' : 'Capital by entry'}
          caption="Each coloured band is one entry. The top of the stack is the total."
          action={
            <div className="toggle" role="group" aria-label="Chart units">
              <button type="button" aria-pressed={!share} onClick={() => setShare(false)}>
                Euro
              </button>
              <button type="button" aria-pressed={share} onClick={() => setShare(true)}>
                Share
              </button>
            </div>
          }
        >
          {chartData.length > 1 ? (
            <StackedAreaChart
              data={chartData}
              ticks={chartTicks(lastMonth)}
              share={share && result.total > 0}
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
        <ul className="legend">
          {result.entries.map((entry) => (
            <li key={entry.id}>
              <i style={{ background: seriesColor(entry.colorIndex) }} />
              <span>{entry.name}</span>
              <b>{formatEur(entry.capital)}</b>
              <span>{formatShare(entry.fraction)}</span>
            </li>
          ))}
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
          ]}
        />
      </section>
    </article>
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
    <p className="hint">
      {product.isin}
      {product.freeSparplan ? ' · zero-fee sparplan' : product.sparplan ? ' · DKB sparplan' : ' · DKB depot'}
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
