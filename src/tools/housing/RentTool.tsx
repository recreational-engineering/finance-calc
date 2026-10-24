import { useMemo } from 'react';
import { ComparisonReport } from '../../components/ComparisonReport';
import type { MoneyPoint } from '../../components/Charts';
import {
  CheckField,
  FieldGroup,
  NumberField,
  SettingsPanel,
  Warnings,
} from '../../components/Fields';
import { formatEur, formatPercentPoints } from '../../platform/format';
import { COMPARE } from '../../platform/palette';
import { comparisonNarrative, payoffLabel } from '../../platform/narrate';
import { useStoredState } from '../../platform/storage';
import { DEFAULT_HOUSING, reviveHousing, simulateHousing } from './model';

const LEFT = COMPARE.left;
const RIGHT = COMPARE.right;
const EQUITY = COMPARE.equity;

export function RentTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v1:rent',
    DEFAULT_HOUSING,
    reviveHousing,
  );
  const result = useMemo(() => simulateHousing(input), [input]);

  const set = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const narrative = comparisonNarrative({
    left: 'Buying',
    right: 'Renting',
    leftNet: result.finalBuyerNet,
    rightNet: result.finalRenterNet,
    points: result.points.map((point) => ({
      month: point.month,
      left: point.buyerNet,
      right: point.renterNet,
    })),
    detail: `Both lives use the same cash over ${formatNumberYears(input.horizonYears)}. The down payment and purchase costs are invested in the MSCI World ETF when you rent. Each month, whoever pays less for housing invests the difference at ${formatPercentPoints(input.msciReturnPercent, 1)}.`,
  });

  const netWorth: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    left: point.buyerNet,
    right: point.renterNet,
  }));
  const cash: MoneyPoint[] = result.points
    .filter((point) => point.month > 0)
    .map((point) => ({
      month: point.month,
      label: point.label,
      left: point.buyerCash,
      right: point.renterCash,
    }));
  const allocation = sample(result.points).map((point) => ({
    month: point.month,
    label: point.label,
    equity: point.equityNet,
    leftEtf: point.buyerEtfNet,
    rightEtf: point.renterEtfNet,
  }));

  const gap = result.finalBuyerNet - result.finalRenterNet;
  const ownerRunning =
    result.totals.maintenance + result.totals.admin + result.totals.grundsteuer + result.totals.insurance;

  return (
    <article className="workspace">
      <SettingsPanel>
        <FieldGroup title="Horizon">
          <NumberField label="Years" value={input.horizonYears} min={1} max={50} step={1} unit="years" onChange={(v) => set('horizonYears', v)} />
        </FieldGroup>
        <FieldGroup title="The flat">
          <NumberField label="Living area" value={input.areaSqm} min={1} step={1} unit="m²" onChange={(v) => set('areaSqm', v)} />
          <NumberField label="Purchase price" value={input.pricePerSqm} min={0} step={50} unit="€/m²" onChange={(v) => set('pricePerSqm', v)} />
          <NumberField label="Cold rent" value={input.coldRentPerSqm} min={0} step={0.1} unit="€/m²" hint="Monthly net cold rent for a new lease." onChange={(v) => set('coldRentPerSqm', v)} />
        </FieldGroup>
        <FieldGroup title="Loan">
          <NumberField label="Down payment" value={input.downPaymentPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('downPaymentPercent', v)} />
          <NumberField label="Interest rate" value={input.mortgageRatePercent} step={0.05} unit="%" hint="Nominal rate, held for the whole term." onChange={(v) => set('mortgageRatePercent', v)} />
          <NumberField label="Initial repayment" value={input.initialRepaymentPercent} min={0} step={0.1} unit="%" hint="Tilgung. The instalment is (interest + this) / 12." onChange={(v) => set('initialRepaymentPercent', v)} />
        </FieldGroup>
        <FieldGroup title="Market">
          <NumberField label="Flat appreciation" value={input.appreciationPercent} step={0.1} unit="% / year" onChange={(v) => set('appreciationPercent', v)} />
          <NumberField label="Rent growth" value={input.rentGrowthPercent} step={0.1} unit="% / year" hint="Once a year, as on an existing lease." onChange={(v) => set('rentGrowthPercent', v)} />
          <NumberField label="MSCI World return" value={input.msciReturnPercent} step={0.1} unit="% / year" hint="Nominal, before German fund tax. Lower it to include the fund fee." onChange={(v) => set('msciReturnPercent', v)} />
        </FieldGroup>
        <FieldGroup title="Purchase costs and upkeep" collapsed>
          <NumberField label="Transfer tax" value={input.transferTaxPercent} min={0} step={0.1} unit="%" hint="Grunderwerbsteuer, 3.5% in Bavaria." onChange={(v) => set('transferTaxPercent', v)} />
          <NumberField label="Notary and register" value={input.notaryPercent} min={0} step={0.1} unit="%" onChange={(v) => set('notaryPercent', v)} />
          <NumberField label="Buyer broker fee" value={input.brokerPercent} min={0} step={0.01} unit="%" hint="Usually 3.57% incl. VAT when the fee is split." onChange={(v) => set('brokerPercent', v)} />
          <NumberField label="Maintenance" value={input.maintenancePerSqmMonth} min={0} step={0.1} unit="€/m²" hint="Per month. Reserve and special assessments." onChange={(v) => set('maintenancePerSqmMonth', v)} />
          <NumberField label="Admin" value={input.adminMonthly} min={0} step={1} unit="€ / month" onChange={(v) => set('adminMonthly', v)} />
          <NumberField label="Property tax" value={input.grundsteuerMonthly} min={0} step={1} unit="€ / month" hint="Grundsteuer. Highly specific after the 2025 reform." onChange={(v) => set('grundsteuerMonthly', v)} />
          <NumberField label="Building insurance" value={input.insuranceMonthly} min={0} step={1} unit="€ / month" onChange={(v) => set('insuranceMonthly', v)} />
          <NumberField label="Inflation of owner costs" value={input.ownerCostInflationPercent} step={0.1} unit="% / year" onChange={(v) => set('ownerCostInflationPercent', v)} />
          <NumberField label="Cost of selling" value={input.sellingCostPercent} min={0} step={0.01} unit="%" onChange={(v) => set('sellingCostPercent', v)} />
          <CheckField
            label="Subtract selling costs"
            checked={input.assumeSale}
            hint="Marks the flat to a cash value, so it can be compared with the ETF."
            onChange={(v) => set('assumeSale', v)}
          />
        </FieldGroup>
        <TaxFields
          apply={input.applyEtfTax}
          basis={input.basiszinsPercent}
          allowance={input.allowance}
          onApply={(v) => set('applyEtfTax', v)}
          onBasis={(v) => set('basiszinsPercent', v)}
          onAllowance={(v) => set('allowance', v)}
        />
        <div className="row-actions">
          <button type="button" className="secondary" onClick={reset}>
            Reset Munich defaults
          </button>
        </div>
      </SettingsPanel>
      {result.points.length > 0 ? (
        <ComparisonReport
          tone={narrative.tone}
          title={narrative.title}
          body={narrative.body}
          warnings={result.warnings}
          stats={[
            { label: 'Buying, net worth', value: formatEur(result.finalBuyerNet) },
            { label: 'Renting, net worth', value: formatEur(result.finalRenterNet) },
            { label: 'Gap', value: formatEur(Math.abs(gap)) },
          ]}
          leftName="Buying"
          rightName="Renting"
          leftColor={LEFT}
          rightColor={RIGHT}
          equityColor={EQUITY}
          netWorth={netWorth}
          cash={cash}
          allocation={allocation}
          equityLabel="Flat after sale costs"
          leftEtfLabel="Buyer’s ETF"
          rightEtfLabel="Renter’s ETF"
          cashCaption="Monthly housing cash after move-in. The down payment and closing costs are in the readouts above."
          facts={[
            { label: 'Purchase price', value: formatEur(result.purchasePrice) },
            { label: 'Closing costs', value: formatEur(result.closingCosts) },
            { label: 'Cash to buy', value: formatEur(result.initialCash) },
            { label: 'Loan', value: formatEur(result.loan) },
            { label: 'Monthly mortgage', value: formatEur(result.monthlyMortgage, 2) },
            { label: 'Starting cold rent', value: formatEur(result.startingRent, 2) },
            { label: 'Loan paid off', value: payoffLabel(result.payoffMonth, result.loan) },
          ]}
          rows={[
            { label: 'Net worth', left: formatEur(result.finalBuyerNet), right: formatEur(result.finalRenterNet) },
            { label: 'Flat after the loan and sale costs', left: formatEur(result.points[result.points.length - 1].equityNet), right: '—' },
            { label: 'ETF after exit tax', left: formatEur(result.points[result.points.length - 1].buyerEtfNet), right: formatEur(result.points[result.points.length - 1].renterEtfNet) },
            { label: 'Expenditure', left: formatEur(result.totals.buyerExpenditure), right: formatEur(result.totals.renterExpenditure) },
            { label: 'Interest paid', left: formatEur(result.totals.interest), right: '—' },
            { label: 'Principal repaid', left: formatEur(result.totals.principal), right: '—' },
            { label: 'Upkeep, tax, insurance, admin', left: formatEur(ownerRunning), right: '—' },
            { label: 'Rent paid', left: '—', right: formatEur(result.totals.rent) },
            { label: 'Purchase costs', left: formatEur(result.closingCosts), right: '—' },
            { label: 'Selling costs', left: formatEur(result.totals.sellingCosts), right: '—' },
            { label: 'Paid into the ETF', left: formatEur(result.totals.buyerEtfContributions), right: formatEur(result.totals.renterEtfContributions) },
          ]}
          methodology={<HousingMethod />}
        />
      ) : (
        <section className="results">
          <Warnings items={result.warnings} />
        </section>
      )}
    </article>
  );
}

function formatNumberYears(years: number): string {
  if (!Number.isFinite(years)) return 'the horizon';
  return `${years.toLocaleString('de-DE')} years`;
}

function sample<T extends { month: number }>(points: T[]): T[] {
  const last = points[points.length - 1]?.month ?? 0;
  const step = last > 15 * 12 ? 60 : 12;
  const wanted = new Set<number>([0, last]);
  for (let month = step; month < last; month += step) wanted.add(month);
  return points.filter((point) => wanted.has(point.month));
}

function TaxFields({
  apply,
  basis,
  allowance,
  onApply,
  onBasis,
  onAllowance,
}: {
  apply: boolean;
  basis: number;
  allowance: number;
  onApply: (value: boolean) => void;
  onBasis: (value: number) => void;
  onAllowance: (value: number) => void;
}) {
  return (
    <FieldGroup title="German ETF tax" collapsed>
      <CheckField
        label="Apply fund tax"
        checked={apply}
        hint="Vorabpauschale while you hold the ETF, and exit tax if you sell. Equity Teilfreistellung 30%, tax 26.375%. No church tax."
        onChange={onApply}
      />
      <NumberField label="Basiszins" value={basis} step={0.01} unit="%" hint="BMF rate for 2026 is 3.20%." onChange={onBasis} />
      <NumberField label="Sparerpauschbetrag" value={allowance} min={0} step={100} unit="€ / year" onChange={onAllowance} />
    </FieldGroup>
  );
}

function HousingMethod() {
  return (
    <details className="method">
      <summary>How this number is built</summary>
      <div className="prose">
        <p>
          The buyer pays the down payment and Bavarian purchase costs on day one, then a
          German annuity: monthly instalment = loan × (nominal interest + initial repayment) / 12,
          with interest on the remaining balance at nominal rate / 12. When the balance is
          smaller than that instalment, only the remainder is paid. Owner-occupied mortgage
          interest is not deducted.
        </p>
        <p>
          The renter invests the same opening cash. After that, both lives are assumed to
          have enough income for the more expensive month. The cheaper life invests the
          difference in an accumulating MSCI World ETF. Heating and other recoverable
          operating costs are left out, because both households pay them.
        </p>
        <p>
          The flat’s price compounds monthly to the yearly appreciation rate. Rent and
          owner costs step up once a year. Net worth is a same-day exit: selling costs come
          off the flat, and the ETF is shown after Vorabpauschale already paid and the tax
          due on a sale. A gain on the owner-occupied flat is treated as tax-free under §23 EStG.
          The rate you type is not a forecast, and refinancing risk is not modelled — the
          mortgage rate stays constant.
        </p>
        <p>
          Expenditure is the money that does not come back: purchase costs, interest, upkeep,
          property tax, insurance, admin, selling costs, and, on the other side, rent.
          Principal, the down payment, and ETF contributions are capital, not expenditure.
        </p>
      </div>
    </details>
  );
}
