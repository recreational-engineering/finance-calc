export interface ToolMeta {
  id: string;
  path: string;
  name: string;
  eyebrow: string;
  summary: string;
  outcome: string;
}

export const tools: ToolMeta[] = [
  {
    id: 'retirement',
    path: '/retirement',
    name: 'Retirement',
    eyebrow: 'Savings plan',
    summary:
      'Start a plan on a chosen date and run it forward for as many years as you like. Each entry has a name, a monthly amount, and its own yearly interest.',
    outcome: 'A stacked chart of capital by entry, plus each entry’s share of the total.',
  },
  {
    id: 'etf',
    path: '/etf',
    name: 'ETFs',
    eyebrow: 'Expected return',
    summary:
      'Pick an ETF or ETC you can buy at DKB. The page estimates a long-term yearly return from the market’s history and from dividends, growth, and today’s prices.',
    outcome: 'A planning rate the retirement plan can use as the interest on that entry.',
  },
  {
    id: 'rent',
    path: '/rent',
    name: 'Rent',
    eyebrow: 'Flat in Munich',
    summary:
      'Buy a flat, or rent the same flat and put every euro you did not have to tie up into an MSCI World ETF. Loan, upkeep, and appreciation start from Munich figures.',
    outcome: 'Net worth, monthly cash, and where the capital sits in each life.',
  },
  {
    id: 'leasing',
    path: '/leasing',
    name: 'Leasing',
    eyebrow: 'Car',
    summary:
      'Buy a car for cash, or lease the same car and invest the free capital in an MSCI World ETF. Depreciation and the lease follow German market conventions.',
    outcome: 'The same wealth and cash comparison as the flat, applied to a car.',
  },
];
