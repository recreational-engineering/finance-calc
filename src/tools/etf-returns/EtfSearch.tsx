import { useMemo, useState } from 'react';
import { formatPercentPoints } from '../../platform/format';
import type { MarketAssumptions } from './assumptions';
import { etfByIsin, etfProducts, searchEtfs, type EtfProduct } from './catalog';
import { estimateEtf, planningRatePercent } from './model';

export function EtfSearch({
  id,
  assumptions,
  onPick,
  selectedIsin,
}: {
  id: string;
  assumptions: MarketAssumptions;
  onPick: (product: EtfProduct) => void;
  selectedIsin?: string;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchEtfs(etfProducts, query, 8), [query]);
  const selected = selectedIsin ? etfByIsin.get(selectedIsin) : undefined;

  return (
    <div className="etf-search">
      <label className="setting" htmlFor={id}>
        <span className="setting-copy">
          <span className="setting-label">ETF</span>
          {selected ? null : (
            <span className="setting-hint">Search the DKB list, or type a rate below</span>
          )}
        </span>
        <span className="setting-control">
          <input
            id={id}
            value={query}
            placeholder={selected ? selected.isin : 'Name or ISIN'}
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
                    <small>{formatPercentPoints(rate, 2)}</small>
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
