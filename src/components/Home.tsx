import { Link } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Home() {
  return (
    <div className="home">
      <p className="eyebrow">Finance desk</p>
      <h1>Calculators for decisions that take years.</h1>
      <p className="lede">
        Klarwert is a small platform for long-horizon money maths. Everything is in euro.
        The worked examples use the Munich market: a savings plan, buying a flat versus
        renting it, and buying a car versus leasing it.
      </p>
      <ol className="tool-grid">
        {tools.map((tool, index) => (
          <li key={tool.id}>
            <Link className="tool-card" to={tool.path}>
              <span className="tool-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="eyebrow">{tool.eyebrow}</span>
              <h2>{tool.name}</h2>
              <p>{tool.summary}</p>
              <span className="tool-outcome">{tool.outcome}</span>
            </Link>
          </li>
        ))}
      </ol>
      <section className="architecture">
        <h2>How a tool is built</h2>
        <p>
          Each tool is a pure function in <code>src/tools</code> plus a page. The function
          does the months; the page only draws it. Shared pieces — German ETF tax, loan
          instalments, euro formatting — live in <code>src/platform</code>. A new calculator
          is another folder and one line in the tool list.
        </p>
      </section>
    </div>
  );
}
