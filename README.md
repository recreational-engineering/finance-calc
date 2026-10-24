# FinCalc

Long-horizon money calculations in euro, with Munich as the default market. The site is published at [recreational-engineering.github.io/finance-calc](https://recreational-engineering.github.io/finance-calc/).

Four tools are included:

- **Retirement** — a savings plan from a start date, with any number of monthly contributions and a yearly interest rate on each. The chart stacks the capital that comes from each entry. An entry can be an ETF from the DKB list; the interest is then that ETF’s planning rate.
- **ETFs** — a long-term yearly return for ETFs and ETCs that can be bought at DKB. History and a forward build are shown separately. The planning rate is what Retirement inserts.
- **Rent** — buy a Munich flat, or rent the same flat and invest the free capital in an MSCI World ETF.
- **Leasing** — buy a car, or lease it and invest the free capital in an MSCI World ETF.

Every market figure is an editable assumption. The pages state which Munich and German figures they start from.

## Run it

```bash
npm install
npm test
npm run dev
```

The dev server uses the same `/finance-calc/` path as the published site: [http://localhost:5173/finance-calc/](http://localhost:5173/finance-calc/).

`npm run build` writes the static site to `dist/`.

## Layout

```
src/platform/     euro formatting, loans, German ETF tax, tool list
src/tools/        one folder per calculator: a pure model, tests, and a page
src/components/   shell, fields, charts
```

The models do not import React. A tool is safe to extend when its tests describe the months, and the page only renders that result.

### Add a tool

1. Create `src/tools/<name>/model.ts` with a pure `simulate` function and `model.test.ts`.
2. Add a page component next to it.
3. Register the route in `src/App.tsx` and the card in `src/platform/registry.ts`.

## How the months work

**Retirement.** Each entry is independent. The deposit is added at month end, so it earns interest from the following month. A yearly rate of `r` becomes a monthly rate of `(1 + r) ^ (1/12) - 1`. The closed form is the ordinary annuity future value, and the tests check against it. The worked example is five DKB listings: Amundi MSCI World 2×, Xtrackers MSCI World Energy, and iShares Essential Metals Producers at €200 a month, plus Amundi MSCI Robotics & AI and Xetra-Gold at €50 a month. Their interest rates are the ETF planning rates, and you can type over them.

**ETFs.** The list is the DKB sparplan universe (a public snapshot of about 950 funds) plus those three depot listings when they were missing from it. For each one, a long euro history — an MSCI factsheet window or the fund’s own prices — is blended with a forward build. Equities use dividend yield, net buybacks, real growth, euro inflation, and a valuation gap that closes over the horizon. Bonds use the yield. Gold’s forward line is inflation only; the gold-price history still has weight. A daily-reset leveraged note is not doubled: the bridge subtracts variance drag and financing, then the TER once. When that history covers at least eight years, the planning rate is 85% history and 15% the forward build, and it stays within 1.25 percentage points of the history. The page plots €10,000 grown at both rates. The planning rate is nominal, in euro, and before German fund tax. It is a planning input, not a forecast.

**Rent.** The buyer pays the down payment and Bavarian purchase costs up front, then a German annuity: instalment = loan × (nominal interest + initial Tilgung) / 12, interest at nominal/12 on the remaining balance. The renter invests that opening cash. After that, both lives spend the same cash: the cheaper month’s difference goes into the ETF. Recoverable operating costs (heating and the like) are omitted because both households pay them. Net worth is a same-day exit: selling costs come off the flat, and the ETF is after German fund tax. An owner-occupied gain is treated as tax-free under §23 EStG.

**Leasing.** Same equal-cash idea, unless you choose to save up from 0 €. The default is a cash purchase, so the lessee invests the price of the car and earns the market return on that sum. The buyer invests whatever the lease costs above upkeep. That new saving can exceed the interest, so the buyer’s ETF balance can rise faster while the lessee still earns more from the market. The monthly lease is `list price × leasing factor / 100`. The buyer replaces the car after a chosen number of years and pays the net cost from their own ETF, so the lessee’s wealth does not jump. The lessee can buy the car when the first contract ends, again from their own ETF. Saving from 0 € is a different question: both ETFs match until they reach the car price, the buyer then spends the ETF, and the lessee keeps it invested at a lower monthly saving rate. Those saving years sit inside the horizon, so the finish is not the same as starting with the car money already in hand. Depreciation is a year-one drop, then a slower yearly drop. Fuel, insurance, vehicle tax, and parking are omitted because both lives use the same car.

**ETF tax.** Accumulating equity fund: Vorabpauschale on the value at the start of each simulation year, capped by that year’s gain, 30% Teilfreistellung, 26.375% Abgeltungsteuer including Solidaritätszuschlag, Sparerpauschbetrag once a year. Assessed Vorabpauschale raises the cost basis. The chart deducts the further tax due if the ETF were sold that month. Church tax is not included. This is a planning model, not a tax return.

## Defaults worth knowing

| | Starting point |
| --- | --- |
| Flat | 75 m² existing apartment, €8,800/m², €22.90/m² cold rent |
| Purchase costs | 3.5% + 2% + 3.57% |
| Mortgage | 4.50% nominal, 2% initial repayment, 20% down |
| Flat growth | 1.5% price, 2.5% rent |
| MSCI World | 7% nominal, before fund tax — this is the lever you set on Rent and Leasing. The ETF page has its own planning rate for a world ETF |
| Basiszins | 3.20% (BMF, 2 January 2026) |
| Car | €38,000 list, €35,000 paid, leasing factor 0.95, 36 months |
| Car value | −22% in year one, then −12% a year |

Sources for the starting points are named in the tool models (`src/tools/housing/model.ts`, `src/tools/leasing/model.ts`). They are assumptions for a calculator, not offers.

## Hosting

The production build is rooted at `/finance-calc/`, which is the GitHub project-site path. Routes use a hash (`/#/rent`), so the host does not need rewrite rules.

### GitHub Pages

[https://recreational-engineering.github.io/finance-calc/](https://recreational-engineering.github.io/finance-calc/)

`.github/workflows/pages.yml` publishes `dist/` on every push to `main`. In the repository settings, Pages → Build and deployment must be **GitHub Actions**. `.github/workflows/ci.yml` runs the tests and the production build on pull requests.
