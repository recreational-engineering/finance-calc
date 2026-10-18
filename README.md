# Klarwert

Long-horizon money calculations in euro, with Munich as the default market. The site is published at [recreational-engineering.github.io/finance-calc](https://recreational-engineering.github.io/finance-calc/).

Three tools are included:

- **Retirement** — a savings plan from a start date, with any number of monthly contributions and a yearly interest rate on each. The chart stacks the capital that comes from each entry.
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

**Retirement.** Each entry is independent. The deposit is added at month end, so it earns interest from the following month. A yearly rate of `r` becomes a monthly rate of `(1 + r) ^ (1/12) - 1`. The closed form is the ordinary annuity future value, and the tests check against it.

**Rent.** The buyer pays the down payment and Bavarian purchase costs up front, then a German annuity: instalment = loan × (nominal interest + initial Tilgung) / 12, interest at nominal/12 on the remaining balance. The renter invests that opening cash. After that, both lives spend the same cash: the cheaper month’s difference goes into the ETF. Recoverable operating costs (heating and the like) are omitted because both households pay them. Net worth is a same-day exit: selling costs come off the flat, and the ETF is after German fund tax. An owner-occupied gain is treated as tax-free under §23 EStG.

**Leasing.** Same equal-cash idea. The default is a cash purchase, so the lessee invests the price of the car. The monthly lease is `list price × leasing factor / 100`. Depreciation is a year-one drop, then a slower yearly drop. Fuel, insurance, vehicle tax, and parking are omitted because both lives use the same car.

**ETF tax.** Accumulating equity fund: Vorabpauschale on the value at the start of each simulation year, capped by that year’s gain, 30% Teilfreistellung, 26.375% Abgeltungsteuer including Solidaritätszuschlag, Sparerpauschbetrag once a year. Assessed Vorabpauschale raises the cost basis. The chart deducts the further tax due if the ETF were sold that month. Church tax is not included. This is a planning model, not a tax return.

## Defaults worth knowing

| | Starting point |
| --- | --- |
| Flat | 75 m² existing apartment, €8,800/m², €22.90/m² cold rent |
| Purchase costs | 3.5% + 2% + 3.57% |
| Mortgage | 4.50% nominal, 2% initial repayment, 20% down |
| Flat growth | 1.5% price, 2.5% rent |
| MSCI World | 7% nominal, before fund tax — this is the lever you set |
| Basiszins | 3.20% (BMF, 2 January 2026) |
| Car | €38,000 list, €35,000 paid, leasing factor 0.95, 36 months |
| Car value | −22% in year one, then −12% a year |

Sources for the starting points are named in the tool models (`src/tools/housing/model.ts`, `src/tools/leasing/model.ts`). They are assumptions for a calculator, not offers.

## Hosting

The production build is rooted at `/finance-calc/`, which is the GitHub project-site path. Routes use a hash (`/#/rent`), so the host does not need rewrite rules.

### GitHub Pages

[https://recreational-engineering.github.io/finance-calc/](https://recreational-engineering.github.io/finance-calc/)

`.github/workflows/pages.yml` publishes `dist/` on every push to `main`. In the repository settings, Pages → Build and deployment must be **GitHub Actions**. `.github/workflows/ci.yml` runs the tests and the production build on pull requests.
