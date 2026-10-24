import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisEur, formatEur, formatShare } from '../platform/format';

export interface MoneyPoint {
  month: number;
  label: string;
  [key: string]: number | string;
}

interface Series {
  key: string;
  name: string;
  color: string;
  stack?: string;
}

const axisTick = {
  fill: '#8a8a8a',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
};
const legendStyle = {
  fontSize: 12,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: '#c8c8c8',
  paddingTop: 4,
};
const legendFormatter = (value: string) => <span style={{ color: '#c8c8c8' }}>{value}</span>;

function axisFromZero(dataMin: number): number {
  return Math.min(0, dataMin);
}

export function ChartCard({
  title,
  caption,
  action,
  children,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="chart-card">
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          {caption ? <p>{caption}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function chartTicks(lastMonth: number): number[] {
  if (lastMonth <= 0) return [0];
  const step =
    lastMonth > 50 * 12 ? 10 * 12 : lastMonth > 20 * 12 ? 5 * 12 : lastMonth > 8 * 12 ? 2 * 12 : 12;
  const ticks = [0];
  for (let month = step; month < lastMonth; month += step) ticks.push(month);
  if (ticks[ticks.length - 1] !== lastMonth) ticks.push(lastMonth);
  return ticks;
}

function rowValue(row: MoneyPoint | undefined, key: string | undefined, fallback: number): number {
  if (!row || !key) return fallback;
  const value = row[key];
  return typeof value === 'number' ? value : fallback;
}

export function ShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
    payload?: MoneyPoint;
  }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const items = payload.map((item) => ({
    name: item.name ?? '',
    color: item.color,
    value: rowValue(row, item.dataKey === undefined ? undefined : String(item.dataKey), Number(item.value)),
  }));
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  return (
    <div className="tooltip">
      <p className="tooltip-title">{row?.label ?? ''}</p>
      <ul>
        {items.map((item) => (
          <li key={item.name}>
            <i style={{ background: item.color }} />
            <span>{item.name}</span>
            <b>
              {formatEur(item.value)}
              <span className="tooltip-share"> {formatShare(total > 0 ? item.value / total : 0)}</span>
            </b>
          </li>
        ))}
        <li>
          <i style={{ background: 'transparent' }} />
          <span>Total</span>
          <b>{formatEur(total)}</b>
        </li>
      </ul>
    </div>
  );
}

export function MoneyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: MoneyPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const title = payload[0]?.payload?.label ?? '';
  return (
    <div className="tooltip">
      <p className="tooltip-title">{title}</p>
      <ul>
        {payload.map((item) => (
          <li key={`${item.name}-${item.color}`}>
            <i style={{ background: item.color }} />
            <span>{item.name}</span>
            <b>{formatEur(Number(item.value))}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineMoneyChart({
  data,
  series,
  ticks,
  curve = 'monotone',
}: {
  data: MoneyPoint[];
  series: Series[];
  ticks: number[];
  curve?: 'monotone' | 'stepAfter';
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1c1c1c" vertical={false} />
          <XAxis
            dataKey="month"
            ticks={ticks}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(month: number) => (month === 0 ? 'Start' : String(month / 12))}
            stroke="#1c1c1c"
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisEur}
            width={72}
            stroke="#1c1c1c"
            domain={[axisFromZero, 'auto']}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Legend wrapperStyle={legendStyle} formatter={legendFormatter} />
          {series.map((item) => (
            <Line
              key={item.key}
              type={curve}
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrowthCompareChart({
  data,
}: {
  data: Array<{ year: number; label: string; historic: number; estimate: number }>;
}) {
  const last = data[data.length - 1]?.year ?? 0;
  const step = last >= 20 ? 5 : last >= 10 ? 2 : 1;
  const ticks = [0];
  for (let year = step; year < last - 0.05; year += step) ticks.push(year);
  if (last > 0) ticks.push(last);
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1c1c1c" vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, 'dataMax']}
            ticks={ticks}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(year: number) => (year === 0 ? 'Start' : String(Math.round(year)))}
            stroke="#1c1c1c"
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisEur}
            width={72}
            stroke="#1c1c1c"
            domain={[0, 'auto']}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Legend wrapperStyle={legendStyle} formatter={legendFormatter} />
          <Line
            type="monotone"
            dataKey="historic"
            name="Historic rate"
            stroke="#4c8dff"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="estimate"
            name="Estimate"
            stroke="#ff7a45"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedAreaChart({
  data,
  series,
  ticks,
  share,
}: {
  data: MoneyPoint[];
  series: Series[];
  ticks: number[];
  share: boolean;
}) {
  return (
    <div className="chart-box chart-box-tall">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          stackOffset={share ? 'expand' : 'none'}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#1c1c1c" vertical={false} />
          <XAxis
            dataKey="month"
            ticks={ticks}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(month: number) => (month === 0 ? 'Start' : String(month / 12))}
            stroke="#1c1c1c"
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={share ? (value: number) => `${Math.round(value * 100)} %` : formatAxisEur}
            width={72}
            stroke="#1c1c1c"
            domain={share ? [0, 1] : [0, 'auto']}
          />
          <Tooltip content={<ShareTooltip />} />
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              fill={item.color}
              fillOpacity={0.55}
              strokeWidth={1.25}
              stackId="capital"
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedBarChart({
  data,
  series,
}: {
  data: MoneyPoint[];
  series: Series[];
}) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1c1c1c" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} stroke="#1c1c1c" interval={0} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisEur}
            width={72}
            stroke="#1c1c1c"
            domain={[0, 'auto']}
          />
          <Tooltip content={<MoneyTooltip />} />
          <Legend wrapperStyle={legendStyle} formatter={legendFormatter} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              fill={item.color}
              stackId={item.stack ?? 'a'}
              isAnimationActive={false}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResultTable({
  leftName,
  rightName,
  rows,
}: {
  leftName: string;
  rightName: string;
  rows: Array<{ label: string; left: string; right: string }>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Comparison of the two paths</caption>
        <thead>
          <tr>
            <th scope="col">At the horizon</th>
            <th scope="col">{leftName}</th>
            <th scope="col">{rightName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.left}</td>
              <td>{row.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
