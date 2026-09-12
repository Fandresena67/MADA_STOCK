import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, Banknote, TrendingUp, PiggyBank, ShoppingCart, Package,
  TriangleAlert, OctagonX, RefreshCw, CircleDot, ArrowRightLeft, FileText,
  Users, CalendarDays, BellRing,
} from 'lucide-react';
import { PageHeader, ErrorBox, Skeleton, SkeletonGrid, SegmentedGroup, FilterButton, Table, Thead, Th, Td } from '../components/common';
import { Button, Card, CardTitle } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';
import {
  dashboardSummary, dashboardTrends, stockDistribution, topProducts, recentActivity, dashboardAlerts, toNum,
} from '../api/stats';
import { unreadCount } from '../api/notifications';

const PRESETS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: 'month', label: 'Ce mois' },
  { key: 'lastmonth', label: 'Mois précédent' },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '12m', label: '12 mois', days: 365 },
  { key: 'custom', label: 'Personnalisée' },
];

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function usePeriod() {
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const now = new Date();
  let params = {};
  if (preset === 'custom') {
    if (custom.from) params.from = custom.from;
    if (custom.to) params.to = custom.to;
  } else if (preset === 'today') {
    params = { from: isoDay(now), to: isoDay(now) };
  } else if (preset === 'month') {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    params = { from: isoDay(first), to: isoDay(now) };
  } else if (preset === 'lastmonth') {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    params = { from: isoDay(first), to: isoDay(last) };
  } else {
    const p = PRESETS.find((x) => x.key === preset);
    if (p?.days) {
      const from = new Date(now.getTime() - (p.days - 1) * 86400000);
      params = { from: isoDay(from), to: isoDay(now) };
    }
  }
  // Garde client (le backend reste l'autorité : 400 si from > to).
  const invalid = Boolean(params.from && params.to && params.to < params.from);
  return { preset, setPreset, custom, setCustom, params, invalid };
}

const ACTION_LABELS = {
  AUTH_REGISTER: 'Inscription', AUTH_LOGIN_SUCCESS: 'Connexion', AUTH_LOGIN_FAILED: 'Échec connexion',
  AUTH_REFRESH: 'Session renouvelée', AUTH_LOGOUT: 'Déconnexion',
  USER_CREATED: 'Utilisateur créé', USER_UPDATED: 'Utilisateur modifié', USER_DELETED: 'Utilisateur supprimé',
  PRODUCT_CREATED: 'Produit créé', PRODUCT_UPDATED: 'Produit modifié', PRODUCT_DEACTIVATED: 'Produit désactivé',
  CATEGORY_CREATED: 'Catégorie créée', CATEGORY_UPDATED: 'Catégorie modifiée',
  STOCK_INITIALIZED: 'Stock initial', STOCK_ENTRY_CREATED: 'Entrée de stock', STOCK_EXIT_CREATED: 'Sortie de stock',
  STOCK_ADJUSTMENT_CREATED: 'Ajustement de stock',
  SUPPLIER_CREATED: 'Fournisseur créé', CUSTOMER_CREATED: 'Client créé',
  PURCHASE_CREATED: 'Achat créé', PURCHASE_CONFIRMED: 'Achat confirmé', PURCHASE_CANCELLED: 'Achat annulé',
  SALE_CREATED: 'Vente créée', SALE_CONFIRMED: 'Vente confirmée', SALE_CANCELLED: 'Vente annulée',
  INVOICE_CREATED: 'Facture créée', INVOICE_UPDATED: 'Facture mise à jour',
};

const KPI_META = {
  cost: { icon: Wallet, tint: 'bg-blue-50 text-blue-600' },
  sale: { icon: Banknote, tint: 'bg-indigo-50 text-indigo-600' },
  revenue: { icon: TrendingUp, tint: 'bg-emerald-50 text-emerald-600' },
  profit: { icon: PiggyBank, tint: 'bg-violet-50 text-violet-600' },
  purchases: { icon: ShoppingCart, tint: 'bg-teal-50 text-teal-600' },
  products: { icon: Package, tint: 'bg-slate-100 text-slate-600' },
  customers: { icon: Users, tint: 'bg-cyan-50 text-cyan-700' },
  today: { icon: CalendarDays, tint: 'bg-emerald-50 text-emerald-600' },
  low: { icon: TriangleAlert, tint: 'bg-amber-50 text-amber-600' },
  out: { icon: OctagonX, tint: 'bg-red-50 text-red-600' },
};

/** Variation vs période précédente : null = base vide, on n'invente aucun %. */
function Delta({ value }) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      title="Évolution vs période précédente"
      className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${
        flat ? 'bg-slate-100 text-slate-500' : up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {up ? '▲' : flat ? '＝' : '▼'} {`${up ? '+' : ''}${Number(value).toLocaleString('fr-FR')} %`}
    </span>
  );
}

function Kpi({ iconKey, label, value, money, sub, delta }) {
  const meta = KPI_META[iconKey] || KPI_META.products;
  const Icon = meta.icon;
  return (
    <Card className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tint}`} aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-slate-500">{label}</span>
        <span className="block truncate text-lg font-bold leading-tight" title={String(value)}>{money ? formatMGA(value) : value}</span>
        {sub && <span className="block truncate text-[11px] text-slate-400">{sub}</span>}
        <Delta value={delta} />
      </span>
    </Card>
  );
}

function ChartCard({ title, subtitle, children, empty, ariaLabel }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3 h-64 sm:h-72" role="img" aria-label={ariaLabel || title}>
        {empty ? <p className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">{empty}</p> : children}
      </div>
    </Card>
  );
}

const ACTIVITY_ICONS = [
  [/^STOCK_/, ArrowRightLeft, 'bg-amber-50 text-amber-600'],
  [/^(PURCHASE_|SALE_)/, FileText, 'bg-blue-50 text-blue-600'],
  [/^(PRODUCT_|CATEGORY_)/, Package, 'bg-slate-100 text-slate-600'],
  [/^(USER_|AUTH_)/, CircleDot, 'bg-violet-50 text-violet-600'],
];

function activityVisual(action) {
  for (const [re, Icon, tint] of ACTIVITY_ICONS) {
    if (re.test(action)) return { Icon, tint };
  }
  return { Icon: CircleDot, tint: 'bg-slate-100 text-slate-600' };
}

export default function DashboardPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { preset, setPreset, custom, setCustom, params, invalid } = usePeriod();
  const periodKey = [params.from || '', params.to || ''];

  const summary = useQuery({
    queryKey: ['dashboard', 'summary', ...periodKey],
    queryFn: () => dashboardSummary({ ...params, compare: true }),
    enabled: !invalid,
  });
  const todayStr = isoDay(new Date());
  const today = useQuery({
    queryKey: ['dashboard', 'today', todayStr],
    queryFn: () => dashboardSummary({ from: todayStr, to: todayStr }),
  });
  const trends = useQuery({ queryKey: ['dashboard', 'trends', ...periodKey], queryFn: () => dashboardTrends('sales-trend', params), enabled: !invalid });
  const distrib = useQuery({ queryKey: ['dashboard', 'distribution'], queryFn: stockDistribution });
  const top = useQuery({ queryKey: ['dashboard', 'top', ...periodKey], queryFn: () => topProducts({ ...params, limit: 5 }), enabled: !invalid });
  const activity = useQuery({ queryKey: ['dashboard', 'activity'], queryFn: () => recentActivity({ limit: 10 }) });
  const alerts = useQuery({ queryKey: ['dashboard', 'alerts'], queryFn: () => dashboardAlerts({ limit: 5 }) });
  // Étape 2 réutilisée telle quelle : compteur backend, polling 60 s (pas de WebSocket/SSE).
  const notifs = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: unreadCount,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  if (!can('dashboard.view')) {
    return <ErrorBox message="Accès refusé : permission dashboard.view requise." />;
  }

  const trendData = (trends.data?.data || []).map((r) => ({ ...r, sales: toNum(r.sales), purchases: toNum(r.purchases), profit: toNum(r.profit) }));
  const hasTrendValues = trendData.some((r) => r.sales > 0 || r.purchases > 0);
  const pieData = distrib.data
    ? [
        { name: 'Normal', value: distrib.data.normal },
        { name: 'Faible', value: distrib.data.low },
        { name: 'Rupture', value: distrib.data.out },
      ]
    : [];
  const hasStock = pieData.some((d) => d.value > 0);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Pilotage de votre entreprise à partir des données réelles"
        action={
          <Button variant="outline" onClick={refresh} icon={<RefreshCw size={16} aria-hidden="true" />}>
            Actualiser
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SegmentedGroup label="Période du tableau de bord">
          {PRESETS.map((p) => (
            <FilterButton key={p.key} active={preset === p.key} onClick={() => setPreset(p.key)}>
              {p.label}
            </FilterButton>
          ))}
        </SegmentedGroup>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="Date début" className="rounded-lg border border-slate-300 px-2 py-1.5" />
            <span aria-hidden="true">→</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="Date fin" className="rounded-lg border border-slate-300 px-2 py-1.5" />
            {invalid && <span className="text-sm text-red-600" role="alert">La date de fin doit suivre la date de début.</span>}
          </div>
        )}
      </div>

      {invalid ? (
        <ErrorBox message="Période invalide : corrigez les dates pour afficher les statistiques." />
      ) : summary.isError ? (
        <ErrorBox message="Impossible de charger les statistiques." onRetry={refresh} />
      ) : summary.isPending ? (
        <div className="mb-6"><SkeletonGrid count={8} /></div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi iconKey="cost" label="Valeur stock (achat)" value={summary.data.stock_value_cost} money />
          <Kpi iconKey="sale" label="Valeur stock (vente)" value={summary.data.stock_value_sale} money />
          <Kpi
            iconKey="revenue"
            label="Chiffre d'affaires"
            value={summary.data.revenue}
            money
            sub={`${summary.data.sales_count} vente${Number(summary.data.sales_count) > 1 ? 's' : ''}`}
            delta={summary.data.compare?.revenue_change}
          />
          <Kpi iconKey="profit" label="Bénéfice réalisé" value={summary.data.profit} money delta={summary.data.compare?.profit_change} />
          <Kpi
            iconKey="purchases"
            label="Total des achats"
            value={summary.data.purchases_total}
            money
            sub={`${summary.data.purchases_count} achat${Number(summary.data.purchases_count) > 1 ? 's' : ''}`}
          />
          <Kpi iconKey="products" label="Produits" value={summary.data.products_total} />
          <Kpi iconKey="customers" label="Clients" value={summary.data.customers_count} />
          <Kpi iconKey="today" label="CA aujourd'hui" value={today.data?.revenue ?? 0} money />
          <Kpi iconKey="low" label="Stock faible" value={summary.data.low_stock} />
          <Kpi iconKey="out" label="Ruptures" value={summary.data.out_of_stock} />
        </div>
      )}
      {!notifs.isPending && !notifs.isError && Number(notifs.data?.count) > 0 && (
        <Link
          to="/app/notifications"
          className="mb-6 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/60 p-3 text-sm outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <BellRing size={17} aria-hidden="true" className="shrink-0 text-primary-600" />
          <span>
            <strong className="tabular-nums">{notifs.data.count} notification{Number(notifs.data.count) > 1 ? 's' : ''} non lue{Number(notifs.data.count) > 1 ? 's' : ''}</strong>
            <span className="text-slate-600"> — voir le centre de notifications</span>
          </span>
        </Link>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Ventes vs Achats" subtitle="Montants confirmés par période" empty={!hasTrendValues && !trends.isPending ? 'Pas encore de données de vente ou d’achat sur cette période' : null}>
          {trends.isPending ? <Skeleton className="h-64" /> : hasTrendValues ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMGA(v)} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="Ventes" stroke="#0284c7" fill="#bae6fd" />
                <Area type="monotone" dataKey="purchases" name="Achats" stroke="#059669" fill="#a7f3d0" />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </ChartCard>
        <ChartCard title="Bénéfice réalisé" subtitle="Revenu − coût snapshoté" empty={!hasTrendValues && !trends.isPending ? 'Pas encore de bénéfice sur cette période' : null}>
          {trends.isPending ? <Skeleton className="h-64" /> : hasTrendValues ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMGA(v)} />
                <Area type="monotone" dataKey="profit" name="Bénéfice" stroke="#7c3aed" fill="#ddd6fe" />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </ChartCard>
        <ChartCard title="État du stock" subtitle="Produits actifs" empty={!hasStock && !distrib.isPending ? 'Aucun produit en stock' : null}>
          {distrib.isPending ? <Skeleton className="h-64" /> : hasStock ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </ChartCard>
        <Card>
          <CardTitle>Produits les plus vendus</CardTitle>
          <p className="-mt-2 mb-3 text-xs text-slate-500">Top 5 — période sélectionnée</p>
          <div>
            {top.isPending ? <Skeleton className="h-40" /> : (top.data || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Pas encore de ventes sur cette période</p>
            ) : (
              <Table minWidth="min-w-[480px]">
                <Thead>
                  <Th>Produit</Th>
                  <Th right>Qté</Th>
                  <Th right>CA</Th>
                  <Th right>Bénéfice</Th>
                </Thead>
                <tbody>
                  {top.data.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <Td><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.sku}</div></Td>
                      <Td right><span className="tabular-nums">{p.quantity_sold}</span></Td>
                      <Td right><span className="tabular-nums">{formatMGA(p.revenue)}</span></Td>
                      <Td right><span className="font-semibold tabular-nums">{formatMGA(p.profit)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Activité récente</CardTitle>
          <div className="space-y-1">
            {activity.isPending ? <Skeleton className="h-40" /> : (activity.data || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucune activité récente</p>
            ) : (
              activity.data.map((a) => {
                const v = activityVisual(a.action);
                const AIcon = v.Icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${v.tint}`} aria-hidden="true">
                      <AIcon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{ACTION_LABELS[a.action] || a.action}</span>
                      <span className="block truncate text-xs text-slate-500">{a.user_name || 'Système'}</span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{new Date(a.created_at).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        <Card>
          <CardTitle
            action={<Link to="/app/alerts" className="rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Tout voir</Link>}
          >
            Alertes
          </CardTitle>
          <div className="space-y-2">
            {alerts.isPending ? <Skeleton className="h-40" /> : (alerts.data || []).length === 0 ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Tout est en ordre : aucun stock faible ni rupture.</p>
            ) : (
              alerts.data.map((p) => (
                <div key={p.id} className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${p.level === 'RUPTURE' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="min-w-0">
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${p.level === 'RUPTURE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{p.level}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">stock {p.quantity} (min {p.min_stock})</span>
                  </div>
                  <Link to="/app/inventory" className="shrink-0 whitespace-nowrap rounded text-xs font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Voir</Link>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
