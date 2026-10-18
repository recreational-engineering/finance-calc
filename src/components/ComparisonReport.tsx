import type { ReactNode } from 'react';
import type { Side } from '../platform/narrate';
import {
  ChartCard,
  LineMoneyChart,
  ResultTable,
  StackedBarChart,
  chartTicks,
  type MoneyPoint,
} from './Charts';
import { Warnings } from './Fields';

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
}) {
  const lastMonth = netWorth[netWorth.length - 1]?.month ?? 0;
  const ticks = chartTicks(typeof lastMonth === 'number' ? lastMonth : 0);

  return (
    <div className="results">
      <Warnings items={warnings} />
      <div className={`verdict tone-${tone}`}>
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
      <ChartCard
        title="Net worth"
        caption="What each life is worth if it stops that year. Property and the car are resale values; ETFs are after German exit tax."
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
      <ChartCard
        title="Capital allocation"
        caption="Where the wealth sits. Each year has two stacks, one per life."
      >
        <StackedBarChart
          data={allocation}
          series={[
            { key: 'equity', name: equityLabel, color: equityColor, stack: 'left' },
            { key: 'leftEtf', name: leftEtfLabel, color: '#c6a15b', stack: 'left' },
            { key: 'rightEtf', name: rightEtfLabel, color: rightColor, stack: 'right' },
          ]}
        />
      </ChartCard>
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
