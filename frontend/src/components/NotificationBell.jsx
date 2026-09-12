import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import {
  listNotifications, unreadCount, markNotificationRead, markAllNotificationsRead,
} from '../api/notifications';
import { metaOf, destinationFor, timeAgo } from '../lib/notifications';

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['notifications'] });
}

/**
 * Cloche du header : compteur backend (polling 60 s), dropdown accessible
 * (Échap + clic extérieur), marquage lu optimiste via React Query.
 */
export function NotificationBell({ dark }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: unreadCount,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
  const count = countQuery.data?.count ?? 0;

  const listQuery = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => listNotifications({ page: 1, limit: 8 }),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const readMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => invalidateAll(queryClient),
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => invalidateAll(queryClient),
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open ]);

  function openNotif(n) {
    if (!n.readAt) readMutation.mutate(n.id);
    setOpen(false);
    const to = destinationFor(n);
    if (to) navigate(to);
    else navigate('/app/notifications');
  }

  const items = listQuery.data?.data || [];
  const btnClass = `relative rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
    dark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={count > 0 ? `Notifications, ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'}
        title="Notifications"
        className={btnClass}
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold tabular-nums text-white"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Notifications récentes"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-bold">Notifications</p>
            <button
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending || count === 0}
              className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Tout marquer comme lu
            </button>
          </div>
          {listQuery.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500" role="status">Chargement…</p>
          ) : listQuery.isError ? (
            <p className="px-3 py-6 text-center text-sm text-red-600" role="alert">
              Chargement impossible.{' '}
              <button onClick={() => listQuery.refetch()} className="font-semibold underline">
                Réessayer
              </button>
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Vous êtes à jour. Aucune nouvelle notification.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const meta = metaOf(n.type);
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotif(n)}
                      role="menuitem"
                      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${n.readAt ? '' : 'bg-primary-50/50'}`}
                    >
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-hidden="true">
                        <Icon size={16} />
                        {!n.readAt && <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${meta.dot}`} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{n.title}</span>
                        <span className="block truncate text-xs text-slate-500">{n.message}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-3 py-2 text-center text-sm font-semibold text-primary-600 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}
