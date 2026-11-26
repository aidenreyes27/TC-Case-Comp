import { NavLink } from 'react-router-dom';
import Mark from './Mark.jsx';
import { getUser, signOut } from '../api.js';
import { useDemoNow } from '../lib/hooks.js';
import { time } from '../lib/format.js';

const NAV = {
  owner: [['/owner', 'Dashboard'], ['/counter', 'Counter'], ['/lead', 'Group orders']],
  staff: [['/counter', 'Counter']],
  lead: [['/lead', 'My group orders']],
};

export default function Shell({ children, wide = false }) {
  const user = getUser();
  const now = useDemoNow();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className={`mx-auto flex items-center gap-4 px-4 py-3 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}>
          <NavLink to="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-xl font-extrabold tracking-tight">Burrito Barrio</span>
          </NavLink>
          <nav className="ml-2 hidden gap-1 sm:flex">
            {(NAV[user?.role] ?? []).map(([to, label]) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-bold ${isActive ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold" title="Demo clock">{time(now)}</span>
            {user && (
              <button className="text-sm font-bold text-ink/60 hover:text-ink" onClick={signOut}>
                Sign out {user.name.split(' ')[0]}
              </button>
            )}
          </div>
        </div>
        {user && (
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
            {(NAV[user.role] ?? []).map(([to, label]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold ${isActive ? 'bg-ink text-paper' : 'text-ink/70'}`}>{label}</NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}>{children}</main>
    </div>
  );
}
