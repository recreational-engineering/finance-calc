import { useMemo, useState } from 'react';
import { formatPercentPoints } from '../../platform/format';
import type { MarketAssumptions } from './assumptions';
import { etfProducts, searchEtfs, type EtfProduct } from './catalog';
import { estimateEtf, planningRatePercent } from './model';

export function EtfSearch({
  id,
  assumptions,
  onPick,
}: {
  id: string;
  assumptions: MarketAssumptions;
  onPick: (product: EtfProduct) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchEtfs(etfProducts, query, 8), [query]);

  return (
    <div className="etf-search">
      <label className="field" htmlFor={id}>
        <span className="field-label">ETF at DKB</span>
        <span className="field-control">
          <input
            id={id}
            value={query}
            placeholder="Name, ISIN, or WKN"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
      </label>
      {query.trim() ? (
        <ul className="etf-hits">
          {matches.length === 0 ? (
            <li className="etf-empty">Nothing in the DKB list matches.</li>
          ) : (
            matches.map((product) => {
              const rate = planningRatePercent(estimateEtf(product, assumptions));
              return (
                <li key={product.isin}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(product);
                      setQuery('');
                    }}
                  >
                    <span>{product.shortName}</span>
                    <small>
                      {product.isin} · {formatPercentPoints(rate, 2)}
                    </small>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
