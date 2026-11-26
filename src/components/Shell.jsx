import { NavLink } from 'react-router-dom';
import Mark from './Mark.jsx';
import { getUser, signOut } from '../api.js';
import { useDemoNow } from '../lib/hooks.js';
import { time } from '../lib/format.js';
import { useReadyNotifier } from '../lib/readyNotifier.js';

const NAV = {
  owner: [['/owner', 'Dashboard'], ['/counter', 'Counter'], ['/lead', 'Group orders']],
  staff: [['/counter', 'Counter']],
  lead: [['/lead', 'My group orders']],
};

export default function Shell({ children, wide = false }) {
  const user = getUser();
  const now = useDemoNow();
  const { banner, dismiss } = useReadyNotifier(['lead', 'owner'].includes(user?.role));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}>
          <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="Burrito Barrio home">
            <Mark />
            <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight sm:text-xl">Burrito Barrio</span>
          </NavLink>
          <nav className="ml-2 hidden gap-1 sm:flex">
            {(NAV[user?.role] ?? []).map(([to, label]) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-bold ${isActive ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold sm:px-3 sm:text-sm" title="Demo clock">{time(now)}</span>
            {user && (
              <button className="whitespace-nowrap text-sm font-bold text-ink/60 hover:text-ink" onClick={signOut}>
                Sign out<span className="hidden sm:inline"> {user.name.split(' ')[0]}</span>
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
      {banner && (
        <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <div key={banner.key} role="alert" className="clip-in flex max-w-xl items-center gap-4 rounded-2xl bg-nopal px-5 py-3 text-white shadow-2xl">
            <div>
              <p className="font-display text-xl font-bold">{banner.title}</p>
              <p className="text-white/85">{banner.body}</p>
            </div>
            <NavLink to={`/g/${banner.code}`} onClick={dismiss} className="whitespace-nowrap rounded-lg bg-white px-3 py-1.5 font-bold text-nopal">View</NavLink>
            <button onClick={dismiss} className="text-2xl leading-none text-white/70 hover:text-white" aria-label="Dismiss">×</button>
          </div>
        </div>
      )}
      <main className={`mx-auto px-4 py-6 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'}`}>{children}</main>
    </div>
  );
}
