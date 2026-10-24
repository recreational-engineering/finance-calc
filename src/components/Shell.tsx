import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const current = tools.find((tool) => tool.path === pathname);
  const title = current?.name ?? 'Tools';
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      tools.filter((tool) => {
        if (!needle) return true;
        return `${tool.name} ${tool.purpose}`.toLowerCase().includes(needle);
      }),
    [needle],
  );

  useEffect(() => {
    document.title = current ? `${current.name} — FinCalc` : 'FinCalc';
  }, [current]);

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to="/">
          <Mark />
          <span className="brand-name">FinCalc</span>
        </Link>
        <nav className="nav" aria-label="Sections">
          <NavLink to="/">Tools</NavLink>
        </nav>
        <div className="top-status">
          <span>EUR</span>
        </div>
      </header>
      <div className="console">
        <aside className="rail" aria-label="Tools">
          <p className="rail-label">Tools</p>
          <label className="rail-search">
            <span className="sr-only">Search tools</span>
            <input
              value={query}
              placeholder="Search tools"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <nav className="rail-nav">
            {visible.map((tool) => (
              <NavLink className="rail-link" key={tool.id} to={tool.path}>
                <span className="rail-name">{tool.name}</span>
              </NavLink>
            ))}
            {visible.length === 0 ? <p className="rail-empty">No tools</p> : null}
          </nav>
        </aside>
        <div className="stage">
          <div className="stage-bar">
            <h1 className="stage-title">{title}</h1>
            {current ? <p className="stage-purpose">{current.purpose}</p> : null}
            <span className="stage-updated">
              <span className="sr-only">Time in Europe/Berlin</span>
              <BerlinClock />
            </span>
          </div>
          <div className="stage-scroll">
            <main className="page">{children}</main>
          </div>
          <footer className="statusbar">
            <p>
              Illustrative calculations in euro, not tax, legal, or investment advice. Munich
              defaults are planning assumptions and can be overwritten. Past market rates are
              not a forecast.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1.2 12.6h3.2V6.1H1.2v6.5Zm5.2 0h3.2V3.1H6.4v9.5Zm5.2 0H14.8V8h-3.2v4.6Z"
      />
    </svg>
  );
}

function BerlinClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <time dateTime={now.toISOString()}>{formatBerlin(now)}</time>;
}

function formatBerlin(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
