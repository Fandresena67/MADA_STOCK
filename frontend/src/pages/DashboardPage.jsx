import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { PageHeader, ErrorBox } from '../components/common';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';
import {
  dashboardSummary, dashboardTrends, stockDistribution, topProducts, recentActivity, dashboardAlerts, toNum,
} from '../api/stats';

const PRESETS = [
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '12m', label: '12 mois', days: 365 },
  { key: 'custom', label: 'Personnalisée', days: null },
];

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function usePeriod() {
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const p = PRESETS.find((x) => x.key === preset);
  let params = {};
  if (preset === 'custom') {
    if (custom.from) params.from = custom.from;
    if (custom.to) params.to = custom.to;
  } else if (p.days) {
    const to = new Date();
    const from = new Date(to.getTime() - (p.days - 1) * 86400000);
    params = { from: isoDay(from), to: isoDay(to) };
  }
  return { preset, setPreset, custom, setCustom, params };
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

function Kpi({ label, value, money }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold" title={value}>{money ? formatMGA(value) : value}</p>
    </div>
  );
}

function Skeleton({ h }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${h || 'h-24'}`} />;
}

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3 h-64">
        {empty ? <p className="flex h-full items-center justify-center text-sm text-slate-400">{empty}</p> : children}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { preset, setPreset, custom, setCustom, params } = usePeriod();
  const periodKey = [params.from || '', params.to || ''];

  const summary = useQuery({ queryKey: ['dashboard', 'summary', ...periodKey], queryFn: () => dashboardSummary(params) });
  const trends = useQuery({ queryKey: ['dashboard', 'trends', ...periodKey], queryFn: () => dashboardTrends('sales-trend', params) });
  const distrib = useQuery({ queryKey: ['dashboard', 'distribution'], queryFn: stockDistribution });
  const top = useQuery({ queryKey: ['dashboard', 'top', ...periodKey], queryFn: () => topProducts({ ...params, limit: 5 }) });
  const activity = useQuery({ queryKey: ['dashboard', 'activity'], queryFn: () => recentActivity({ limit: 10 }) });
  const alerts = useQuery({ queryKey: ['dashboard', 'alerts'], queryFn: () => dashboardAlerts({ limit: 5 }) });

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
          <button onClick={refresh} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Actualiser
          </button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${preset === p.key ? 'bg-primary-600 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="Date début" className="rounded-lg border border-slate-300 px-2 py-1.5" />
            <span>→</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="Date fin" className="rounded-lg border border-slate-300 px-2 py-1.5" />
          </div>
        )}
      </div>

      {summary.isError ? (
        <ErrorBox message="Impossible de charger les statistiques." onRetry={refresh} />
      ) : summary.isPending ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Valeur stock (achat)" value={summary.data.stock_value_cost} money />
          <Kpi label="Valeur stock (vente)" value={summary.data.stock_value_sale} money />
          <Kpi label="Chiffre d'affaires" value={summary.data.revenue} money />
          <Kpi label="Bénéfice réalisé" value={summary.data.profit} money />
          <Kpi label="Total des achats" value={summary.data.purchases_total} money />
          <Kpi label="Produits" value={summary.data.products_total} />
          <Kpi label="Stock faible" value={summary.data.low_stock} />
          <Kpi label="Ruptures" value={summary.data.out_of_stock} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Ventes vs Achats" subtitle="Montants confirmés par période" empty={!hasTrendValues && !trends.isPending ? 'Pas encore de données de vente ou d’achat sur cette période' : null}>
          {trends.isPending ? <Skeleton h="h-64" /> : hasTrendValues ? (
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
          {trends.isPending ? <Skeleton h="h-64" /> : hasTrendValues ? (
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
          {distrib.isPending ? <Skeleton h="h-64" /> : hasStock ? (
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
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Produits les plus vendus</h3>
          <p className="text-xs text-slate-500">Top 5 — période sélectionnée</p>
          <div className="mt-3">
            {top.isPending ? <Skeleton h="h-40" /> : (top.data || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Pas encore de ventes sur cette période</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Produit</th>
                    <th className="py-2 text-right">Qté</th>
                    <th className="py-2 text-right">CA</th>
                    <th className="py-2 text-right">Bénéfice</th>
                  </tr>
                </thead>
                <tbody>
                  {top.data.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-2"><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.sku}</div></td>
                      <td className="py-2 text-right">{p.quantity_sold}</td>
                      <td className="py-2 text-right">{formatMGA(p.revenue)}</td>
                      <td className="py-2 text-right">{formatMGA(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Activité récente</h3>
          <div className="mt-3 space-y-2">
            {activity.isPending ? <Skeleton h="h-40" /> : (activity.data || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucune activité récente</p>
            ) : (
              activity.data.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{ACTION_LABELS[a.action] || a.action}</span>
                    <span className="text-slate-500"> — {a.user_name || 'Système'}</span>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{new Date(a.created_at).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Alertes</h3>
            <Link to="/app/alerts" className="text-sm font-semibold text-primary-600 hover:underline">Tout voir</Link>
          </div>
          <div className="mt-3 space-y-2">
            {alerts.isPending ? <Skeleton h="h-40" /> : (alerts.data || []).length === 0 ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Tout est en ordre : aucun stock faible ni rupture.</p>
            ) : (
              alerts.data.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0">
                  <div>
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${p.level === 'RUPTURE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{p.level}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-500"> — stock {p.quantity} (min {p.min_stock})</span>
                  </div>
                  <Link to="/app/inventory" className="whitespace-nowrap text-xs font-semibold text-primary-600 hover:underline">Voir</Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
