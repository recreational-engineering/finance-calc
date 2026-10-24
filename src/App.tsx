import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Home } from './components/Home';
import { Shell } from './components/Shell';

const RetirementTool = lazy(() =>
  import('./tools/retirement/RetirementTool').then((module) => ({ default: module.RetirementTool })),
);
const RentTool = lazy(() =>
  import('./tools/housing/RentTool').then((module) => ({ default: module.RentTool })),
);
const LeasingTool = lazy(() =>
  import('./tools/leasing/LeasingTool').then((module) => ({ default: module.LeasingTool })),
);

export function App() {
  return (
    <HashRouter>
      <Shell>
        <Suspense fallback={<p className="empty">Loading dashboard…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/retirement" element={<RetirementTool />} />
            <Route path="/rent" element={<RentTool />} />
            <Route path="/leasing" element={<LeasingTool />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </Shell>
    </HashRouter>
  );
}
