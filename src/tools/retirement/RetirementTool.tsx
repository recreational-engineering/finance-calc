import { useEffect, useMemo, useState } from 'react';
import {
  ChartCard,
  StackedAreaChart,
  chartTicks,
  type MoneyPoint,
} from '../../components/Charts';
import { Facts, FieldGroup, NumberField, TextField, Warnings } from '../../components/Fields';
import { formatEur, formatPercentPoints, formatShare } from '../../platform/format';
import { seriesColor } from '../../platform/palette';
import { useStoredState } from '../../platform/storage';
import {
  DEFAULT_RETIREMENT,
  reviveRetirement,
  simulateRetirement,
  type SavingsEntry,
} from './model';

export function RetirementTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v1:retirement',
    DEFAULT_RETIREMENT,
    reviveRetirement,
  );
  const [share, setShare] = useState(false);
  const result = useMemo(() => simulateRetirement(input), [input]);

  useEffect(() => {
    document.title = 'Retirement — Klarwert';
    return () => {
      document.title = 'Klarwert — Munich finance tools';
    };
  }, []);

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
          <p className="eyebrow">Savings plan</p>
          <h1>Retirement</h1>
          <p>
            Set the month the plan starts and how many years to run. Each entry pays in
            every month at its own interest rate. The areas are that entry’s capital.
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
                  step={0.1}
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
        <Warnings items={result.warnings} />
        <div className="verdict tone-left">
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
                  <td>{formatPercentPoints(entry.yearlyInterestPercent, 1)}</td>
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
