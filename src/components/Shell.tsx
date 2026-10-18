import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">K</span>
          <span>
            <span className="brand-name">Klarwert</span>
            <span className="brand-sub">Munich, long horizon</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Tools">
          {tools.map((tool) => (
            <NavLink key={tool.id} to={tool.path}>
              {tool.name}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <p>
          Illustrative calculations in euro, not tax, legal, or investment advice. Munich
          defaults are planning assumptions and can be overwritten. Past market rates are
          not a forecast.
        </p>
      </footer>
    </div>
  );
}
