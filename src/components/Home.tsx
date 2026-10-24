import { Link } from 'react-router-dom';
import { tools } from '../platform/registry';

export function Home() {
  return (
    <div className="tool-index">
      <div className="tool-index-head" aria-hidden="true">
        <span>Tool</span>
        <span>What it answers</span>
      </div>
      <ul>
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link to={tool.path}>
              <span>{tool.name}</span>
              <span>{tool.purpose}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
