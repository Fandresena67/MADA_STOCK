import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCheck, Trash2 } from 'lucide-react';
import {
  listNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
} from '../api/notifications';
import { metaOf, destinationFor, timeAgo, formatDateTime } from '../lib/notifications';
import { PageHeader, Loading, ErrorBox, Pagination, EmptyState, FilterButton, SegmentedGroup } from '../components/common';
import { Button } from '../components/ui';

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
  { key: 'stock', label: 'Stock', types: ['STOCK_LOW', 'STOCK_OUT'] },
  { key: 'sales', label: 'Ventes', types: ['SALE_CREATED', 'SALE_CONFIRMED'] },
  { key: 'purchases', label: 'Achats', types: ['PURCHASE_CONFIRMED'] },
  { key: 'invoices', label: 'Factures', types: ['INVOICE_CREATED', 'INVOICE_PAID'] },
  { key: 'security', label: 'Sécurité', types: ['USER_ACTIVITY', 'SECURITY', 'SYSTEM'] },
];

const PAGE_SIZE = 15;

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['notifications'] });
}

export default function NotificationsPage() {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeTab = TABS.find((t) => t.key === tab);
  const serverType = activeTab.types?.length === 1 ? activeTab.types[0] : undefined;

  const query = useQuery({
    queryKey: ['notifications', 'page', page, tab],
    queryFn: () =>
      listNotifications({
        page,
        limit: PAGE_SIZE,
        ...(tab === 'unread' ? { unread: true } : {}),
        ...(serverType ? { type: serverType } : {}),
      }),
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
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNotification(id),
    onSuccess: () => invalidateAll(queryClient),
  });

  function selectTab(key) {
    setTab(key);
    setPage(1);
  }

  function openNotif(n) {
    if (!n.readAt) readMutation.mutate(n.id);
    const to = destinationFor(n);
    if (to) navigate(to);
  }

  async function removeNotif(n) {
    if (!window.confirm('Supprimer cette notification ?')) return;
    try {
      await deleteMutation.mutateAsync(n.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Suppression impossible.');
    }
  }

  // Groupes multi-types : filtre client sur la page courante (pagination serveur inchangée).
  const rawItems = query.data?.data || [];
  const items = activeTab.types?.length > 1 ? rawItems.filter((n) => activeTab.types.includes(n.type)) : rawItems;
  const meta = query.data?.meta || null;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Alertes stock, ventes, achats, factures et sécurité"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => readAllMutation.mutate()}
            loading={readAllMutation.isPending}
            icon={<CheckCheck size={15} aria-hidden="true" />}
          >
            Tout marquer comme lu
          </Button>
        }
      />
      <SegmentedGroup label="Filtrer les notifications">
        {TABS.map((t) => (
          <FilterButton key={t.key} active={tab === t.key} onClick={() => selectTab(t.key)}>
            {t.label}
          </FilterButton>
        ))}
      </SegmentedGroup>
      <div className="mt-3">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox message={query.error?.response?.data?.error || 'Chargement impossible'} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellRing size={22} aria-hidden="true" />}
            title="Vous êtes à jour"
            message="Aucune nouvelle notification. Tout est calme pour le moment."
            action={
              <Link
                to="/app/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Voir le tableau de bord
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const metaInfo = metaOf(n.type);
              const Icon = metaInfo.icon;
              const to = destinationFor(n);
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4 ${n.readAt ? 'border-slate-200' : 'border-primary-200 bg-primary-50/40'}`}
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500" aria-hidden="true">
                    <Icon size={18} />
                    {!n.readAt && <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${metaInfo.dot}`} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{n.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {metaInfo.label}
                      </span>
                      {!n.readAt && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700">
                          Non lu
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400" title={formatDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {to && (
                        <button
                          onClick={() => openNotif(n)}
                          className="rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          {n.readAt ? 'Voir' : 'Marquer comme lu et voir'}
                        </button>
                      )}
                      {!to && !n.readAt && (
                        <button
                          onClick={() => readMutation.mutate(n.id)}
                          className="rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          Marquer comme lu
                        </button>
                      )}
                      {n.userId != null && (
                        <button
                          onClick={() => removeNotif(n)}
                          aria-label={`Supprimer : ${n.title}`}
                          className="inline-flex items-center gap-1 rounded text-sm font-semibold text-red-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
