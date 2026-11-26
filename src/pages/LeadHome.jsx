import { Link } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { usePoll } from '../lib/hooks.js';
import { slotLabel, money, GROUP_TYPES } from '../lib/format.js';

export const STATUS = {
  open: ['Collecting orders', 'bg-marigold/20 text-ink'],
  locked: ['Sent to kitchen', 'bg-pacific/15 text-pacific'],
  cooking: ['Cooking', 'bg-pacific/15 text-pacific'],
  ready: ['Ready for pickup', 'bg-nopal/15 text-nopal'],
  picked_up: ['Picked up', 'bg-ink/10 text-ink/60'],
  no_show: ['Not picked up', 'bg-chile/10 text-chile'],
  released: ['Released (unpaid)', 'bg-chile/10 text-chile'],
};

export default function LeadHome() {
  const { data, error } = usePoll('/groups/mine', 4000);
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">Group orders</h1>
          <p className="mt-1 text-ink/60">Book a pickup time, share the link, and pay once to hold your spot.</p>
        </div>
        <Link to="/lead/new" className="btn-primary px-5 py-3 text-lg">Start a group order</Link>
      </div>
      {error && <p className="mt-6 text-chile">{error}</p>}
      <div className="mt-8 space-y-3">
        {data?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
            <p className="font-display text-2xl font-bold">No group orders yet</p>
            <p className="mt-1 text-ink/60">Start one, then text the link to your crew.</p>
          </div>
        )}
        {data?.map((o) => {
          const [label, cls] = STATUS[o.status];
          return (
            <Link key={o.id} to={`/g/${o.code}`} className="panel flex flex-wrap items-center gap-4 hover:ring-2 hover:ring-ink/20">
              <div className="flex-1">
                <p className="font-display text-xl font-bold">{o.groupName}</p>
                <p className="text-sm text-ink/60">{GROUP_TYPES[o.groupType]} · pickup {slotLabel(o.slot)}</p>
              </div>
              <span className="text-sm"><b>{o.burritos}</b> burritos · {money(o.total)}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${cls}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
