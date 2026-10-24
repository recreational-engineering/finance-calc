import type { ReactNode } from 'react';
import type { Side } from '../platform/narrate';
import { COMPARE, TRACE } from '../platform/palette';
import {
  ChartCard,
  LineMoneyChart,
  ResultTable,
  StackedBarChart,
  chartTicks,
  type MoneyPoint,
} from './Charts';
import { Facts, StatusLine, Warnings } from './Fields';

export function ComparisonReport({
  tone,
  title,
  body,
  stats,
  warnings,
  leftName,
  rightName,
  leftColor,
  rightColor,
  equityColor,
  netWorth,
  cash,
  allocation,
  equityLabel,
  leftEtfLabel,
  rightEtfLabel,
  cashCaption,
  rows,
  methodology,
  rightEquityLabel,
  rightEquityColor = TRACE.cyan,
  etfBalances,
  etfCaption,
  gain,
  gainCaption,
  facts,
}: {
  tone: Side;
  title: string;
  body: string;
  stats: Array<{ label: string; value: string }>;
  warnings: string[];
  leftName: string;
  rightName: string;
  leftColor: string;
  rightColor: string;
  equityColor: string;
  netWorth: MoneyPoint[];
  cash: MoneyPoint[];
  allocation: MoneyPoint[];
  equityLabel: string;
  leftEtfLabel: string;
  rightEtfLabel: string;
  cashCaption: string;
  rows: Array<{ label: string; left: string; right: string }>;
  methodology: ReactNode;
  rightEquityLabel?: string;
  rightEquityColor?: string;
  etfBalances?: MoneyPoint[];
  etfCaption?: string;
  gain?: MoneyPoint[];
  gainCaption?: string;
  facts?: Array<{ label: string; value: string }>;
}) {
  const lastMonth = netWorth[netWorth.length - 1]?.month ?? 0;
  const ticks = chartTicks(typeof lastMonth === 'number' ? lastMonth : 0);
  const showRightEquity =
    Boolean(rightEquityLabel) && allocation.some((row) => Number(row.rightEquity) > 1);
  const allocationSeries = [
    { key: 'equity', name: equityLabel, color: equityColor, stack: 'left' },
    { key: 'leftEtf', name: leftEtfLabel, color: COMPARE.etf, stack: 'left' },
    ...(showRightEquity
      ? [{ key: 'rightEquity', name: rightEquityLabel ?? '', color: rightEquityColor, stack: 'right' }]
      : []),
    { key: 'rightEtf', name: rightEtfLabel, color: rightColor, stack: 'right' },
  ];

  return (
    <div className="results">
      <Warnings items={warnings} />
      <div className={`verdict tone-${tone}`}>
        <StatusLine warnings={warnings} />
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <dl className="stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {facts && facts.length > 0 ? <Facts items={facts} /> : null}
      <ChartCard
        title="Net worth"
        caption="Resale value. ETFs are after German exit tax."
      >
        <LineMoneyChart
          data={netWorth}
          ticks={ticks}
          series={[
            { key: 'left', name: leftName, color: leftColor },
            { key: 'right', name: rightName, color: rightColor },
          ]}
        />
      </ChartCard>
      <ChartCard title="Capital allocation" caption="Two stacks each year, one per life.">
        <StackedBarChart data={allocation} series={allocationSeries} />
      </ChartCard>
      {etfBalances && etfBalances.length > 0 ? (
        <ChartCard title="ETF after exit tax" caption={etfCaption}>
          <LineMoneyChart
            data={etfBalances}
            ticks={ticks}
            series={[
              { key: 'left', name: leftEtfLabel, color: leftColor },
              { key: 'right', name: rightEtfLabel, color: rightColor },
            ]}
          />
        </ChartCard>
      ) : null}
      {gain && gain.length > 0 ? (
        <ChartCard title="ETF return after tax" caption={gainCaption}>
          <LineMoneyChart
            data={gain}
            ticks={ticks}
            series={[
              { key: 'left', name: leftEtfLabel, color: leftColor },
              { key: 'right', name: rightEtfLabel, color: rightColor },
            ]}
          />
        </ChartCard>
      ) : null}
      <ChartCard title="Monthly cash" caption={cashCaption}>
        <LineMoneyChart
          data={cash}
          ticks={ticks}
          curve="stepAfter"
          series={[
            { key: 'left', name: leftName, color: leftColor },
            { key: 'right', name: rightName, color: rightColor },
          ]}
        />
      </ChartCard>
      <ResultTable leftName={leftName} rightName={rightName} rows={rows} />
      {methodology}
    </div>
  );
}
