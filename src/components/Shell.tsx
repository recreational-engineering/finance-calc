import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const current = tools.find((tool) => tool.path === pathname);
  const title = current?.name ?? 'Overview';
  const channel = current?.channel ?? 'console.overview';
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      tools.filter((tool) => {
        if (!needle) return true;
        return `${tool.name} ${tool.eyebrow} ${tool.channel}`.toLowerCase().includes(needle);
      }),
    [needle],
  );
  const overviewVisible =
    !needle || 'overview dashboards console.overview'.includes(needle);

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
          <NavLink to="/" end>
            Dashboards
          </NavLink>
          {tools.map((tool) => (
            <NavLink key={tool.id} to={tool.path}>
              {tool.name}
            </NavLink>
          ))}
        </nav>
        <div className="top-status">
          <span className="status-chip">
            <i className="live-dot" />
            Model
          </span>
          <span>EUR</span>
        </div>
      </header>
      <div className="console">
        <aside className="rail" aria-label="Dashboards">
          <p className="rail-label">Dashboards</p>
          <label className="rail-search">
            <span className="sr-only">Search dashboards</span>
            <input
              value={query}
              placeholder="Search dashboards"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <nav className="rail-nav">
            {overviewVisible ? (
              <NavLink className="rail-link" to="/" end>
                <span>Overview</span>
                <span className="rail-channel">console.overview</span>
              </NavLink>
            ) : null}
            {visible.length > 0 ? <p className="rail-group">Models</p> : null}
            {visible.map((tool) => (
              <NavLink className="rail-link" key={tool.id} to={tool.path}>
                <span>{tool.name}</span>
                <span className="rail-channel">{tool.channel}</span>
              </NavLink>
            ))}
            {!overviewVisible && visible.length === 0 ? (
              <p className="rail-empty">No dashboards</p>
            ) : null}
          </nav>
        </aside>
        <div className="stage">
          <div className="stage-bar">
            <span className="stage-kicker">Dashboards</span>
            <h1 className="stage-title">{title}</h1>
            <span className="stage-channel">{channel}</span>
            <span className="stage-updated">
              Updated <BerlinClock />
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
