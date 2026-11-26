import { Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './api.js';
import SignIn from './pages/SignIn.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import LeadHome from './pages/LeadHome.jsx';
import NewGroup from './pages/NewGroup.jsx';
import GroupOrder from './pages/GroupOrder.jsx';
import Counter from './pages/Counter.jsx';
import Dashboard from './pages/Dashboard.jsx';

const HOME = { owner: '/owner', staff: '/counter', lead: '/lead' };

function Guard({ roles, children }) {
  const u = getUser();
  if (!u) return <Navigate to={`/?next=${encodeURIComponent(window.location.pathname)}`} replace />;
  if (!roles.includes(u.role)) return <Navigate to={HOME[u.role]} replace />;
  return children;
}

export default function App() {
  const u = getUser();
  return (
    <Routes>
      <Route path="/" element={u ? <Navigate to={HOME[u.role]} replace /> : <SignIn />} />
      <Route path="/lead" element={<Guard roles={['lead', 'owner']}><LeadHome /></Guard>} />
      <Route path="/lead/new" element={<Guard roles={['lead', 'owner']}><NewGroup /></Guard>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/g/:code" element={<GroupOrder />} />
      <Route path="/counter" element={<Guard roles={['staff', 'owner']}><Counter /></Guard>} />
      <Route path="/owner" element={<Guard roles={['owner']}><Dashboard /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
