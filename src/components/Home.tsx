import { Link } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Home() {
  return (
    <div className="home">
      <dl className="stats">
        <div>
          <dt>Currency</dt>
          <dd>EUR</dd>
        </div>
        <div>
          <dt>Market</dt>
          <dd>Munich</dd>
        </div>
        <div>
          <dt>Models</dt>
          <dd>{String(tools.length).padStart(2, '0')}</dd>
        </div>
      </dl>
      <div className="dash-grid">
        {tools.map((tool) => (
          <Link className="dash-card" key={tool.id} to={tool.path}>
            <header>
              <span className="eyebrow">{tool.eyebrow}</span>
              <span className="dash-open">Open</span>
            </header>
            <h2>{tool.name}</h2>
            <p>{tool.summary}</p>
            <p className="dash-outcome">{tool.outcome}</p>
          </Link>
        ))}
      </div>
      <div className="table-wrap channel-table">
        <table>
          <caption className="sr-only">Calculator dashboards</caption>
          <thead>
            <tr>
              <th scope="col">Subsystem</th>
              <th scope="col">Channel</th>
              <th scope="col">Dashboard</th>
              <th scope="col">Output</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.id}>
                <th scope="row">{tool.eyebrow}</th>
                <td className="mono">{tool.channel}</td>
                <td>
                  <Link to={tool.path}>{tool.name}</Link>
                </td>
                <td>{tool.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="home-note">
        FinCalc runs long-horizon euro models. Every market figure is a channel. Open a
        dashboard to overwrite the Munich defaults and read the model forward.
      </p>
    </div>
  );
}
