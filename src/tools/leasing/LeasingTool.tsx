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
  const allocation = result.points.map((point) => ({
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
        <FieldGroup title="Time">
          <NumberField label="Years" value={input.horizonYears} min={1} max={25} step={1} unit="years" onChange={(v) => set('horizonYears', v)} />
          <NumberField
            label="Replace the car every"
            value={input.ownershipYears}
            min={1}
            max={30}
            step={1}
            unit="years"
            hint="The buyer sells and buys again. Set this longer than the horizon to keep one car."
            onChange={(v) => set('ownershipYears', v)}
          />
        </FieldGroup>
        <FieldGroup title="Price">
          <NumberField label="List price" value={input.listPrice} min={0} step={500} unit="€" hint="Bruttolistenpreis. The lease is this price times the leasing factor." onChange={(v) => set('listPrice', v)} />
          <NumberField label="Price you pay" value={input.purchasePrice} min={0} step={500} unit="€" hint="What the buyer actually pays. Depreciation starts here." onChange={(v) => set('purchasePrice', v)} />
        </FieldGroup>
        <FieldGroup title="Lease">
          <NumberField label="Leasing factor" value={input.leasingFactor} min={0} step={0.01} unit="%" hint="0.95 means the monthly rate is 0.95% of the list price." onChange={(v) => set('leasingFactor', v)} />
          <NumberField label="Contract length" value={input.leaseTermMonths} min={1} max={72} step={1} unit="months" onChange={(v) => set('leaseTermMonths', v)} />
          <NumberField label="Special payment" value={input.specialPayment} min={0} step={100} unit="€" hint="Sonderzahlung at the start of each contract." onChange={(v) => set('specialPayment', v)} />
          <NumberField label="Transfer fee" value={input.transferFee} min={0} step={50} unit="€" hint="Überführung at the start of each contract." onChange={(v) => set('transferFee', v)} />
          <CheckField
            label="Buy at the end of the contract"
            checked={input.buyAfterLease}
            hint="One contract. The lessee then pays the buyout from their ETF and owns the car."
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
                  : `0 uses the depreciated value, ${formatEur(residual)}.`
              }
              onChange={(v) => set('buyoutPrice', v)}
            />
          ) : null}
        </FieldGroup>
        <FieldGroup title="Starting point">
          <CheckField
            label="Save up from 0 €"
            checked={input.sameStartingCapital}
            hint="Off: the car money is already there. The buyer owns the car on day one, and the lessee invests that money."
            onChange={(v) => set('sameStartingCapital', v)}
          />
          {input.sameStartingCapital ? (
            <>
              <p className="setting-note">
                The finish changes because this purchase happens later. Both save the same amount
                until the ETF can buy the car, and those years count inside the horizon. The buyer
                then spends the ETF. The lessee keeps it invested and saves less once the lease starts.
              </p>
              <NumberField
                label="Monthly saving"
                value={input.monthlySavings}
                min={0}
                step={50}
                unit="€ / month"
                hint="What each person can put toward the car and the ETF. The lease and upkeep come out of this."
                onChange={(v) => set('monthlySavings', v)}
              />
            </>
          ) : null}
        </FieldGroup>
        <FieldGroup title="ETF">
          <NumberField label="Expected return" value={input.msciReturnPercent} step={0.1} unit="% / year" hint="Nominal MSCI World return, before German fund tax." onChange={(v) => set('msciReturnPercent', v)} />
        </FieldGroup>
        <FieldGroup title="Depreciation and upkeep" collapsed>
          <NumberField label="Drop in year one" value={input.firstYearDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('firstYearDropPercent', v)} />
          <NumberField label="Drop each later year" value={input.laterDropPercent} min={0} max={100} step={1} unit="%" onChange={(v) => set('laterDropPercent', v)} />
          <NumberField label="Owner upkeep" value={input.ownerMaintenanceBase} min={0} step={5} unit="€ / month" hint="First year of owning the car." onChange={(v) => set('ownerMaintenanceBase', v)} />
          <NumberField label="Extra upkeep each year of age" value={input.ownerMaintenanceAgeStep} min={0} step={1} unit="€ / month" onChange={(v) => set('ownerMaintenanceAgeStep', v)} />
          <NumberField label="Lease upkeep" value={input.leaseMaintenance} min={0} step={5} unit="€ / month" hint="Stays flat, because the leased car is replaced by a new contract." onChange={(v) => set('leaseMaintenance', v)} />
          <NumberField label="Registration" value={input.registrationFee} min={0} step={10} unit="€" hint="Paid each time someone buys a car, including a buyout." onChange={(v) => set('registrationFee', v)} />
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
          allocationAsLines
          allocationCaption="Each line is one part of a life’s wealth, every month. A new car lifts the buyer’s car line and lowers the buyer’s ETF by what the sale did not cover."
          equityLabel="Buyer’s car"
          rightEquityLabel="Lessee’s car"
          leftEtfLabel="Buyer’s ETF"
          rightEtfLabel="Lessee’s ETF"
          etfBalances={etfBalances}
          etfCaption={
            input.sameStartingCapital
              ? 'Both start at 0 €. The buyer pays for the car from the ETF. The lessee keeps the shares.'
              : 'Balance after exit tax. A replacement is paid from the buyer’s ETF.'
          }
          gain={gain}
          gainCaption="Market growth after fund tax. Money paid in or taken out is not included."
          cashCaption={cashCaption(input, result)}
          facts={[
            { label: 'Monthly lease', value: formatEur(result.monthlyLease, 2) },
            { label: 'Contracts', value: formatNumber(result.contracts) },
            { label: 'Cars the buyer purchases', value: formatNumber(result.buyerPurchases) },
            ...(input.sameStartingCapital
              ? []
              : [
                  { label: 'Buyer pays at the start', value: formatEur(result.buyerInitialCash) },
                  { label: 'Lessee invests at the start', value: formatEur(result.startingCash - result.lesseeInitialCash) },
                ]),
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
            { label: 'Buyer’s car at the end', value: formatEur(result.finalCarValue) },
            ...(result.loan > 0
              ? [
                  { label: 'Loan', value: formatEur(result.loan) },
                  { label: 'Loan instalment', value: formatEur(result.loanPayment, 2) },
                  { label: 'Loan paid off', value: payoffLabel(result.payoffMonth, result.loan) },
                ]
              : []),
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
            ...(result.totals.buyerUnfunded + result.totals.lesseeUnfunded > 0
              ? [{
                  label: 'Car money the ETF could not cover',
                  left: result.totals.buyerUnfunded > 0 ? formatEur(result.totals.buyerUnfunded) : '—',
                  right: result.totals.lesseeUnfunded > 0 ? formatEur(result.totals.lesseeUnfunded) : '—',
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
    ? `Both start at 0 € and save ${formatEur(input.monthlySavings)} a month into an MSCI World ETF at ${rate}. The finish differs from the default because those saving years are part of the horizon: the buyer then spends the ETF on the car, and the lessee keeps that sum invested while saving less.`
    : `Both already have the car money. The buyer owns the car immediately. The lessee invests what they did not have to spend, at ${rate}, and the monthly difference follows after that.`;
  const replacement =
    input.ownershipYears < input.horizonYears
      ? ` The buyer replaces the car every ${formatNumber(input.ownershipYears)} years, paid from the buyer’s ETF.`
      : '';
  const buyout = input.buyAfterLease
    ? ` The lessee buys the car for ${formatEur(result.buyoutPrice ?? plannedBuyoutPrice(input))} when the contract ends.`
    : '';
  return `${opening}${replacement}${buyout}`;
}

function cashCaption(input: LeasingInput, result: LeasingResult): string {
  const parts = [
    input.sameStartingCapital
      ? 'Monthly car cash. Both pay nothing while the ETF is still short of the car.'
      : 'Monthly car cash after the opening payment.',
  ];
  if (result.buyerPurchases > 1 || result.lesseePurchases > 1 || input.buyAfterLease) {
    parts.push('A new car or a buyout is paid from that person’s ETF. It does not become savings for the other life.');
  }
  if (!input.buyAfterLease) {
    parts.push('A new contract’s special payment and transfer fee land in the first month of that contract.');
  }
  return parts.join(' ');
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
          The buyer sells the car after the number of years you set and buys another at the
          same price. The net cost, after the sale, comes out of the buyer’s ETF. The
          lessee’s wealth does not rise because the buyer bought a car. The sale is untaxed,
          which is the usual case for a private sale at a loss. The lease payment is list
          price × leasing factor / 100. A new contract starts every term, with another
          special payment and transfer fee, unless the lessee buys the car at the end of the
          first contract. The buyout defaults to the car’s depreciated value and is paid
          from the lessee’s ETF. From then on the lessee pays owner upkeep and the car
          counts in their net worth. If the horizon cuts a contract short, the model keeps
          charging the monthly rate and does not add an early-return penalty.
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
