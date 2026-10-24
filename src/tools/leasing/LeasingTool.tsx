import { useMemo } from 'react';
import type { MoneyPoint } from '../../components/Charts';
import { ComparisonReport } from '../../components/ComparisonReport';
import { CheckField, FieldGroup, NumberField, SettingsPanel, Warnings } from '../../components/Fields';
import { formatEur, formatNumber, formatPercentPoints, horizonLabel } from '../../platform/format';
import { COMPARE } from '../../platform/palette';
import { comparisonNarrative, payoffLabel } from '../../platform/narrate';
import { useStoredState } from '../../platform/storage';
import { DEFAULT_LEASING, plannedBuyoutPrice, reviveLeasing, simulateLeasing } from './model';
import type { LeasingInput, LeasingResult } from './model';

const LEFT = COMPARE.left;
const RIGHT = COMPARE.right;
const EQUITY = COMPARE.equity;

export function LeasingTool() {
  const [input, setInput, reset] = useStoredState(
    'klarwert:v1:leasing',
    DEFAULT_LEASING,
    reviveLeasing,
  );
  const result = useMemo(() => simulateLeasing(input), [input]);

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
    detail: narrativeDetail(input, result),
  });

  const netWorth: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    left: point.buyerNet,
    right: point.lesseeNet,
  }));
  const etfBalances: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    left: point.buyerEtfNet,
    right: point.lesseeEtfNet,
  }));
  const gain: MoneyPoint[] = result.points.map((point) => ({
    month: point.month,
    label: point.label,
    left: point.buyerMarketGain,
    right: point.lesseeMarketGain,
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
    rightEquity: point.lesseeCarEquity,
    leftEtf: point.buyerEtfNet,
    rightEtf: point.lesseeEtfNet,
  }));
  const gap = result.finalBuyerNet - result.finalLesseeNet;
  const residual = plannedBuyoutPrice({ ...input, buyoutPrice: 0 });
  const lesseeUpkeep = result.totals.leaseMaintenance + result.totals.lesseeOwnerMaintenance;
  const lesseeSaving = input.monthlySavings - result.monthlyLease - input.leaseMaintenance;

  return (
    <article className="workspace">
      <SettingsPanel>
        <FieldGroup title="Horizon">
          <NumberField label="Years" value={input.horizonYears} min={1} max={25} step={1} unit="years" onChange={(v) => set('horizonYears', v)} />
          <NumberField
            label="Replace car after"
            value={input.ownershipMonths}
            min={1}
            max={360}
            step={1}
            unit="months"
            hint="The buyer sells at this age and buys another. 96 months is 8 years."
            onChange={(v) => set('ownershipMonths', v)}
          />
        </FieldGroup>
        <FieldGroup title="The car">
          <NumberField label="List price" value={input.listPrice} min={0} step={500} unit="€" hint="Bruttolistenpreis, the base of the leasing factor." onChange={(v) => set('listPrice', v)} />
          <NumberField label="Price you pay" value={input.purchasePrice} min={0} step={500} unit="€" hint="After discount. Depreciation starts from this." onChange={(v) => set('purchasePrice', v)} />
        </FieldGroup>
        <FieldGroup title="Lease">
          <NumberField label="Leasing factor" value={input.leasingFactor} min={0} step={0.01} unit="%" hint="Monthly rate as a percent of the list price. 0.95 means 0.95%." onChange={(v) => set('leasingFactor', v)} />
          <NumberField label="Contract length" value={input.leaseTermMonths} min={1} max={72} step={1} unit="months" onChange={(v) => set('leaseTermMonths', v)} />
          <NumberField label="Special payment" value={input.specialPayment} min={0} step={100} unit="€" hint="Sonderzahlung, due at the start of each contract." onChange={(v) => set('specialPayment', v)} />
          <NumberField label="Transfer fee" value={input.transferFee} min={0} step={50} unit="€" hint="Überführung, due at the start of each contract." onChange={(v) => set('transferFee', v)} />
          <CheckField
            label="Buy at the end of the contract"
            checked={input.buyAfterLease}
            hint="One contract, then the lessee pays the buyout and owns the car. A new lease does not start."
            onChange={(v) => set('buyAfterLease', v)}
          />
          {input.buyAfterLease ? (
            <NumberField
              label="Buyout price"
              value={input.buyoutPrice}
              min={0}
              step={100}
              unit="€"
              hint={
                input.buyoutPrice > 0
                  ? `Used instead of the depreciated value of ${formatEur(residual)}.`
                  : `Leave at 0 to pay the depreciated value, ${formatEur(residual)}.`
              }
              onChange={(v) => set('buyoutPrice', v)}
            />
          ) : null}
        </FieldGroup>
        <FieldGroup title="Starting cash">
          <CheckField
            label="Both save up from 0 €"
            checked={input.sameStartingCapital}
            hint="Both save the same amount until the ETF reaches the car. The buyer then buys with the ETF. The lessee keeps it, starts the lease, and saves less from then on."
            onChange={(v) => set('sameStartingCapital', v)}
          />
          {input.sameStartingCapital ? (
            <NumberField
              label="Monthly saving"
              value={input.monthlySavings}
              min={0}
              step={50}
              unit="€ / month"
              hint="Available for the car and the ETF. The lease, transfer fee, and upkeep come out of this first."
              onChange={(v) => set('monthlySavings', v)}
            />
          ) : null}
        </FieldGroup>
        <FieldGroup title="Value and upkeep">
          <NumberField label="Drop in year one" value={input.firstYearDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('firstYearDropPercent', v)} />
          <NumberField label="Drop each later year" value={input.laterDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('laterDropPercent', v)} />
          <NumberField label="Owner upkeep" value={input.ownerMaintenanceBase} min={0} step={5} unit="€ / month" hint="In the first year of ownership." onChange={(v) => set('ownerMaintenanceBase', v)} />
          <NumberField label="Extra upkeep per year of age" value={input.ownerMaintenanceAgeStep} min={0} step={1} unit="€ / month" onChange={(v) => set('ownerMaintenanceAgeStep', v)} />
          <NumberField label="Lease upkeep" value={input.leaseMaintenance} min={0} step={5} unit="€ / month" hint="The leased car stays inside a new contract, so upkeep stays flat." onChange={(v) => set('leaseMaintenance', v)} />
          <NumberField label="Registration" value={input.registrationFee} min={0} step={10} unit="€" hint="Paid when a car is bought, including a buyout." onChange={(v) => set('registrationFee', v)} />
        </FieldGroup>
        <FieldGroup title="MSCI World">
          <NumberField label="Expected return" value={input.msciReturnPercent} step={0.1} unit="% / year" hint="Nominal, before German fund tax." onChange={(v) => set('msciReturnPercent', v)} />
        </FieldGroup>
        <FieldGroup title="Finance the purchase" collapsed>
          <CheckField
            label="Buy with a car loan"
            checked={input.financePurchase}
            hint="Off by default. A cash purchase leaves the price invested. Saving from 0 € buys with the ETF and does not use this loan."
            onChange={(v) => set('financePurchase', v)}
          />
          {input.financePurchase ? (
            <>
              <NumberField label="Down payment" value={input.downPaymentPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('downPaymentPercent', v)} />
              <NumberField label="Loan interest" value={input.loanRatePercent} step={0.1} unit="%" onChange={(v) => set('loanRatePercent', v)} />
              <NumberField label="Loan term" value={input.loanYears} min={1} max={12} step={1} unit="years" onChange={(v) => set('loanYears', v)} />
            </>
          ) : null}
        </FieldGroup>
        <FieldGroup title="German ETF tax" collapsed>
          <CheckField
            label="Apply fund tax"
            checked={input.applyEtfTax}
            hint="Same Vorabpauschale model as the flat tool. Teilfreistellung 30%, tax 26.375%, no church tax."
            onChange={(v) => set('applyEtfTax', v)}
          />
          <NumberField label="Basiszins" value={input.basiszinsPercent} step={0.01} unit="%" onChange={(v) => set('basiszinsPercent', v)} />
          <NumberField label="Sparerpauschbetrag" value={input.allowance} min={0} step={100} unit="€ / year" onChange={(v) => set('allowance', v)} />
        </FieldGroup>
        <div className="row-actions">
          <button type="button" className="secondary" onClick={reset}>
            Reset example
          </button>
        </div>
      </SettingsPanel>
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
          equityLabel="Buyer’s car after the loan"
          rightEquityLabel="Lessee’s car"
          leftEtfLabel="Buyer’s ETF"
          rightEtfLabel="Lessee’s ETF"
          etfBalances={etfBalances}
          etfCaption={
            input.sameStartingCapital
              ? 'Both start at 0 €. The buyer pays for the car from the ETF. The lessee keeps the shares.'
              : 'Balance after exit tax, including money paid in and taken out.'
          }
          gain={gain}
          gainCaption="Market growth after fund tax. Money paid in or taken out is not included."
          cashCaption={cashCaption(input, result)}
          facts={[
            { label: 'Monthly lease', value: formatEur(result.monthlyLease, 2) },
            { label: 'Contracts', value: formatNumber(result.contracts) },
            { label: 'Buyer’s cars', value: formatNumber(result.buyerPurchases) },
            { label: 'Buyer’s cash at the start', value: formatEur(result.buyerInitialCash) },
            { label: 'Lessee’s cash at the start', value: formatEur(result.lesseeInitialCash) },
            ...(input.sameStartingCapital
              ? [
                  {
                    label: 'ETF buys the car',
                    value: result.acquisitionMonth
                      ? horizonLabel(result.acquisitionMonth)
                      : 'Not within the horizon',
                  },
                  ...(result.acquisitionMonth
                    ? [
                        {
                          label: 'Lessee saves during the lease',
                          value: signedMonthly(lesseeSaving),
                        },
                      ]
                    : []),
                ]
              : []),
            ...(input.buyAfterLease
              ? [
                  {
                    label: 'Lessee buys the car',
                    value: result.buyoutMonth
                      ? `${formatEur(result.buyoutPrice ?? 0)} at ${horizonLabel(result.buyoutMonth)}`
                      : 'Contract runs past the horizon',
                  },
                ]
              : []),
            { label: 'Car value at the end', value: formatEur(result.finalCarValue) },
            { label: 'Loan', value: formatEur(result.loan) },
            { label: 'Loan instalment', value: result.loan > 0 ? formatEur(result.loanPayment, 2) : '—' },
            { label: 'Loan paid off', value: payoffLabel(result.payoffMonth, result.loan) },
          ]}
          rows={[
            { label: 'Net worth', left: formatEur(result.finalBuyerNet), right: formatEur(result.finalLesseeNet) },
            {
              label: 'Car after the loan',
              left: formatEur(last.carEquity),
              right: last.lesseeCarEquity > 0 ? formatEur(last.lesseeCarEquity) : '—',
            },
            { label: 'ETF after exit tax', left: formatEur(last.buyerEtfNet), right: formatEur(last.lesseeEtfNet) },
            {
              label: 'ETF return after tax',
              left: formatEur(result.buyerMarketGain),
              right: formatEur(result.lesseeMarketGain),
            },
            { label: 'Expenditure', left: formatEur(result.totals.buyerExpenditure), right: formatEur(result.totals.lesseeExpenditure) },
            {
              label: 'Value lost on the car',
              left: formatEur(result.totals.depreciation),
              right: result.lesseePurchases > 0 ? formatEur(result.totals.lesseeDepreciation) : '—',
            },
            { label: 'Loan interest', left: formatEur(result.totals.loanInterest), right: '—' },
            { label: 'Lease payments', left: '—', right: formatEur(result.totals.leasePayments) },
            { label: 'Special payments and transfer', left: '—', right: formatEur(result.totals.specialPayments + result.totals.transferFees) },
            ...(result.totals.lesseeBuyout > 0
              ? [{ label: 'Buyout paid', left: '—', right: formatEur(result.totals.lesseeBuyout) }]
              : []),
            ...(result.totals.buyerSaleProceeds + result.totals.lesseeSaleProceeds > 0
              ? [{
                  label: 'Car sales',
                  left: result.totals.buyerSaleProceeds > 0 ? formatEur(result.totals.buyerSaleProceeds) : '—',
                  right: result.totals.lesseeSaleProceeds > 0 ? formatEur(result.totals.lesseeSaleProceeds) : '—',
                }]
              : []),
            { label: 'Upkeep', left: formatEur(result.totals.ownerMaintenance), right: formatEur(lesseeUpkeep) },
            {
              label: 'Registration',
              left: formatEur(result.totals.registration),
              right: result.totals.lesseeRegistration > 0 ? formatEur(result.totals.lesseeRegistration) : '—',
            },
            { label: 'Paid into the ETF', left: formatEur(result.totals.buyerEtfContributions), right: formatEur(result.totals.lesseeEtfContributions) },
            ...(result.totals.buyerEtfWithdrawals + result.totals.lesseeEtfWithdrawals > 0
              ? [{
                  label: 'Taken out of the ETF',
                  left: formatEur(result.totals.buyerEtfWithdrawals),
                  right: formatEur(result.totals.lesseeEtfWithdrawals),
                }]
              : []),
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

function signedMonthly(amount: number): string {
  if (amount >= 0) return `${formatEur(amount)} / month`;
  return `Draws ${formatEur(-amount)} / month`;
}

function narrativeDetail(input: LeasingInput, result: LeasingResult): string {
  const rate = formatPercentPoints(input.msciReturnPercent, 1);
  const opening = input.sameStartingCapital
    ? `Both start at 0 € and save ${formatEur(input.monthlySavings)} a month into an MSCI World ETF at ${rate}. When the ETF can buy the car, the buyer sells shares and pays for it. The lessee keeps the shares, starts the lease, and saves only what remains after the lease.`
    : `Both lives start with the same cash. Whatever is not needed to buy or to start the lease goes into an MSCI World ETF at ${rate}, and so does every later monthly saving.`;
  const replacement =
    input.ownershipMonths < input.horizonYears * 12
      ? ` The buyer replaces the car every ${formatNumber(input.ownershipMonths)} months.`
      : '';
  const buyout = input.buyAfterLease
    ? ` The lessee buys the car for ${formatEur(result.buyoutPrice ?? plannedBuyoutPrice(input))} when the contract ends.`
    : '';
  return `${opening}${replacement}${buyout}`;
}

function cashCaption(input: LeasingInput, result: LeasingResult): string {
  if (input.sameStartingCapital) {
    return 'Monthly car cash. Both pay nothing until the ETF can buy the car.';
  }
  if (input.buyAfterLease) {
    return 'Monthly car cash after the opening payment. The buyout lands in the last month of the contract.';
  }
  if (result.buyerPurchases > 1) {
    return 'Monthly car cash after the opening payment. A replacement shows the new price minus the sale.';
  }
  return 'Monthly car cash after the opening payment. A new contract’s fees land in its first month.';
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
          The default opening gives both lives the same pile of cash: enough for the more
          expensive first payment. The rest is invested at once. Later, the life with the
          smaller monthly bill invests the difference. A cash purchase is the default, so
          the lessee invests almost the whole price and then earns the market return on
          that sum. The buyer invests the amount the lease costs above upkeep. That new
          saving can be larger than the interest on the lessee’s balance, so the buyer’s
          ETF line can rise faster even while the lessee earns more from the market. The
          return chart leaves the new savings out.
        </p>
        <p>
          “Save up from 0 €” is the other opening. Both pay the same monthly saving into
          the ETF until it can cover the price plus registration, after exit tax. The buyer
          sells shares and buys the car. The lessee keeps the shares, starts the lease, and
          from then on invests only what the lease, transfer fee, and upkeep do not take.
          If that bill is larger than the saving, the difference is sold out of the ETF.
        </p>
        <p>
          The buyer sells the car at the age you set and buys another at the same price.
          The sale is untaxed, which is the usual case for a private sale at a loss. The
          lease payment is list price × leasing factor / 100. A new contract starts every
          term, with another special payment and transfer fee, unless the lessee buys the
          car at the end of the first contract. The buyout defaults to the car’s depreciated
          value. From then on the lessee pays owner upkeep and the car counts in their net
          worth. If the horizon cuts a contract short, the model keeps charging the monthly
          rate and does not add an early-return penalty.
        </p>
        <p>
          The car’s resale value falls by the year-one rate, linearly through that year,
          then by the later yearly rate. A replacement starts that clock again. Expenditure
          for an owner is depreciation, loan interest, upkeep, and registration. Expenditure
          for a lessee is every lease payment, special payment, transfer fee, lease upkeep,
          and, after a buyout, depreciation and registration. The car that remains, and the
          ETF, are capital. A car loan, if you switch it on, is a standard annuity at
          nominal rate / 12. Fuel, insurance, vehicle tax, and parking cancel out.
        </p>
      </div>
    </details>
  );
}
