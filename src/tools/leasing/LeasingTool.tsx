import { useEffect, useMemo } from 'react';
import type { MoneyPoint } from '../../components/Charts';
import { ComparisonReport } from '../../components/ComparisonReport';
import { CheckField, Facts, FieldGroup, NumberField, Warnings } from '../../components/Fields';
import { formatEur, formatNumber, formatPercentPoints } from '../../platform/format';
import { comparisonNarrative, payoffLabel } from '../../platform/narrate';
import { useStoredState } from '../../platform/storage';
import { DEFAULT_LEASING, reviveLeasing, simulateLeasing } from './model';

const LEFT = '#0e6e6b';
const RIGHT = '#c4622d';
const EQUITY = '#234e70';

export function LeasingTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v1:leasing',
    DEFAULT_LEASING,
    reviveLeasing,
  );
  const result = useMemo(() => simulateLeasing(input), [input]);

  useEffect(() => {
    document.title = 'Leasing — Klarwert';
    return () => {
      document.title = 'Klarwert — Munich finance tools';
    };
  }, []);

  const set = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const narrative = comparisonNarrative({
    left: 'Buying',
    right: 'Leasing',
    leftNet: result.finalBuyerNet,
    rightNet: result.finalLesseeNet,
    points: result.points.map((point) => ({
      month: point.month,
      left: point.buyerNet,
      right: point.lesseeNet,
    })),
    detail: `Both lives start with the same cash. Whatever is not needed to buy or to start the lease goes into an MSCI World ETF at ${formatPercentPoints(input.msciReturnPercent, 1)}, and so does every later monthly saving.`,
  });

  const netWorth: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    left: point.buyerNet,
    right: point.lesseeNet,
  }));
  const cash: MoneyPoint[] = result.points
    .filter((point) => point.month > 0)
    .map((point) => ({
      month: point.month,
      label: point.label,
      left: point.buyerCash,
      right: point.lesseeCash,
    }));
  const last = result.points[result.points.length - 1];
  const allocation = sample(result.points).map((point) => ({
    month: point.month,
    label: point.label,
    equity: point.carEquity,
    leftEtf: point.buyerEtfNet,
    rightEtf: point.lesseeEtfNet,
  }));
  const gap = result.finalBuyerNet - result.finalLesseeNet;

  return (
    <article className="workspace">
      <section className="panel">
        <header className="panel-intro">
          <p className="eyebrow">Car</p>
          <h1>Leasing</h1>
          <p>
            Buy a car, or lease it and invest the free capital in an MSCI World ETF.
            The default is a new compact car paid in cash, against a 36-month private lease.
            Fuel, insurance, vehicle tax, and Munich parking are left out: both lives drive
            the same car.
          </p>
        </header>
        <FieldGroup title="The car">
          <NumberField label="Horizon" value={input.horizonYears} min={1} max={25} step={1} unit="years" onChange={(v) => set('horizonYears', v)} />
          <NumberField label="List price" value={input.listPrice} min={0} step={500} unit="€" hint="Bruttolistenpreis, the base of the leasing factor." onChange={(v) => set('listPrice', v)} />
          <NumberField label="Price you pay" value={input.purchasePrice} min={0} step={500} unit="€" hint="After discount. Depreciation starts from this." onChange={(v) => set('purchasePrice', v)} />
        </FieldGroup>
        <FieldGroup title="Lease">
          <NumberField label="Leasing factor" value={input.leasingFactor} min={0} step={0.01} unit="%" hint="Monthly rate as a percent of the list price. 0.95 means 0.95%." onChange={(v) => set('leasingFactor', v)} />
          <NumberField label="Contract length" value={input.leaseTermMonths} min={1} max={72} step={1} unit="months" onChange={(v) => set('leaseTermMonths', v)} />
          <NumberField label="Special payment" value={input.specialPayment} min={0} step={100} unit="€" hint="Sonderzahlung, due at the start of each contract." onChange={(v) => set('specialPayment', v)} />
          <NumberField label="Transfer fee" value={input.transferFee} min={0} step={50} unit="€" hint="Überführung, due at the start of each contract." onChange={(v) => set('transferFee', v)} />
        </FieldGroup>
        <FieldGroup title="Value and upkeep">
          <NumberField label="Drop in year one" value={input.firstYearDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('firstYearDropPercent', v)} />
          <NumberField label="Drop each later year" value={input.laterDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('laterDropPercent', v)} />
          <NumberField label="Owner upkeep" value={input.ownerMaintenanceBase} min={0} step={5} unit="€ / month" hint="In the first year of ownership." onChange={(v) => set('ownerMaintenanceBase', v)} />
          <NumberField label="Extra upkeep per year of age" value={input.ownerMaintenanceAgeStep} min={0} step={1} unit="€ / month" onChange={(v) => set('ownerMaintenanceAgeStep', v)} />
          <NumberField label="Lease upkeep" value={input.leaseMaintenance} min={0} step={5} unit="€ / month" hint="The leased car stays inside a new contract, so upkeep stays flat." onChange={(v) => set('leaseMaintenance', v)} />
          <NumberField label="Registration" value={input.registrationFee} min={0} step={10} unit="€" hint="Paid once by the buyer." onChange={(v) => set('registrationFee', v)} />
        </FieldGroup>
        <FieldGroup title="MSCI World">
          <NumberField label="Expected return" value={input.msciReturnPercent} step={0.1} unit="% / year" hint="Nominal, before German fund tax." onChange={(v) => set('msciReturnPercent', v)} />
        </FieldGroup>
        <details className="method">
          <summary>Finance the purchase</summary>
          <div className="fields">
            <CheckField
              label="Buy with a car loan"
              checked={input.financePurchase}
              hint="Off by default. Cash purchase is what frees the whole price for the ETF."
              onChange={(v) => set('financePurchase', v)}
            />
            {input.financePurchase ? (
              <>
                <NumberField label="Down payment" value={input.downPaymentPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('downPaymentPercent', v)} />
                <NumberField label="Loan interest" value={input.loanRatePercent} step={0.1} unit="%" onChange={(v) => set('loanRatePercent', v)} />
                <NumberField label="Loan term" value={input.loanYears} min={1} max={12} step={1} unit="years" onChange={(v) => set('loanYears', v)} />
              </>
            ) : null}
          </div>
        </details>
        <details className="method">
          <summary>German ETF tax</summary>
          <div className="fields">
            <CheckField
              label="Apply fund tax"
              checked={input.applyEtfTax}
              hint="Same Vorabpauschale model as the flat tool. Teilfreistellung 30%, tax 26.375%, no church tax."
              onChange={(v) => set('applyEtfTax', v)}
            />
            <NumberField label="Basiszins" value={input.basiszinsPercent} step={0.01} unit="%" onChange={(v) => set('basiszinsPercent', v)} />
            <NumberField label="Sparerpauschbetrag" value={input.allowance} min={0} step={100} unit="€ / year" onChange={(v) => set('allowance', v)} />
          </div>
        </details>
        <Facts
          items={[
            { label: 'Monthly lease', value: formatEur(result.monthlyLease, 2) },
            { label: 'Contracts', value: formatNumber(result.contracts) },
            { label: 'Buyer’s cash at the start', value: formatEur(result.buyerInitialCash) },
            { label: 'Lessee’s cash at the start', value: formatEur(result.lesseeInitialCash) },
            { label: 'Car value at the end', value: formatEur(result.finalCarValue) },
            { label: 'Loan', value: formatEur(result.loan) },
            { label: 'Loan instalment', value: result.loan > 0 ? formatEur(result.loanPayment, 2) : '—' },
            { label: 'Loan paid off', value: payoffLabel(result.payoffMonth, result.loan) },
          ]}
        />
        <div className="row-actions">
          <button type="button" className="secondary" onClick={reset}>
            Reset example
          </button>
        </div>
      </section>
      {result.points.length > 0 && last ? (
        <ComparisonReport
          tone={narrative.tone}
          title={narrative.title}
          body={narrative.body}
          warnings={result.warnings}
          stats={[
            { label: 'Buying, net worth', value: formatEur(result.finalBuyerNet) },
            { label: 'Leasing, net worth', value: formatEur(result.finalLesseeNet) },
            { label: 'Gap', value: formatEur(Math.abs(gap)) },
          ]}
          leftName="Buying"
          rightName="Leasing"
          leftColor={LEFT}
          rightColor={RIGHT}
          equityColor={EQUITY}
          netWorth={netWorth}
          cash={cash}
          allocation={allocation}
          equityLabel="Car after the loan"
          leftEtfLabel="Buyer’s ETF"
          rightEtfLabel="Lessee’s ETF"
          cashCaption="Monthly cash after the initial payment. A new contract’s special payment and transfer fee land in the first month of that contract."
          rows={[
            { label: 'Net worth', left: formatEur(result.finalBuyerNet), right: formatEur(result.finalLesseeNet) },
            { label: 'Car after the loan', left: formatEur(last.carEquity), right: '—' },
            { label: 'ETF after exit tax', left: formatEur(last.buyerEtfNet), right: formatEur(last.lesseeEtfNet) },
            { label: 'Expenditure', left: formatEur(result.totals.buyerExpenditure), right: formatEur(result.totals.lesseeExpenditure) },
            { label: 'Value lost on the car', left: formatEur(result.totals.depreciation), right: '—' },
            { label: 'Loan interest', left: formatEur(result.totals.loanInterest), right: '—' },
            { label: 'Lease payments', left: '—', right: formatEur(result.totals.leasePayments) },
            { label: 'Special payments and transfer', left: '—', right: formatEur(result.totals.specialPayments + result.totals.transferFees) },
            { label: 'Upkeep', left: formatEur(result.totals.ownerMaintenance), right: formatEur(result.totals.leaseMaintenance) },
            { label: 'Registration', left: formatEur(result.totals.registration), right: '—' },
            { label: 'Paid into the ETF', left: formatEur(result.totals.buyerEtfContributions), right: formatEur(result.totals.lesseeEtfContributions) },
          ]}
          methodology={<LeasingMethod />}
        />
      ) : (
        <section className="results">
          <Warnings items={result.warnings} />
        </section>
      )}
    </article>
  );
}

function sample<T extends { month: number }>(points: T[]): T[] {
  const last = points[points.length - 1]?.month ?? 0;
  const step = last > 15 * 12 ? 60 : 12;
  const wanted = new Set<number>([0, last]);
  for (let month = step; month < last; month += step) wanted.add(month);
  return points.filter((point) => wanted.has(point.month));
}

function LeasingMethod() {
  return (
    <details className="method">
      <summary>How this number is built</summary>
      <div className="prose">
        <p>
          The buyer and the lessee start with the same pile of cash: enough for the more
          expensive opening payment. The rest is invested at once. Later, the life with the
          smaller monthly bill invests the difference. A cash purchase is the default, so
          the lessee invests almost the whole price. A car loan, if you switch it on, is a
          standard annuity at nominal rate / 12 and only the down payment is free capital.
        </p>
        <p>
          The lease payment is list price × leasing factor / 100. A new contract starts
          every term, with another special payment and transfer fee, until the horizon ends.
          If the horizon cuts a contract short, the model keeps charging the monthly rate and
          does not add an early-return penalty. The car’s resale value falls by the year-one
          rate, linearly through that year, then by the later yearly rate. Private car sales
          are treated as untaxed, which is the usual case when the car is sold at a loss.
        </p>
        <p>
          Expenditure for the buyer is depreciation, loan interest, upkeep, and registration.
          Expenditure for the lessee is every lease payment, special payment, transfer fee,
          and lease upkeep. The car that remains, and the ETF, are capital. Fuel, insurance,
          vehicle tax, and parking cancel out and are not included.
        </p>
      </div>
    </details>
  );
}
