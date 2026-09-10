import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Loading, ErrorBox, Pagination } from '../components/common';
import { StockBadge } from '../components/common';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';
import {
  reportStock, reportStockouts, reportSales, reportPurchases, reportProfit, reportMovements, downloadCSV,
} from '../api/stats';

const TABS = [
  { key: 'stock', label: 'Stock' },
  { key: 'stockouts', label: 'Ruptures' },
  { key: 'sales', label: 'Ventes' },
  { key: 'purchases', label: 'Achats' },
  { key: 'profit', label: 'Bénéfices' },
  { key: 'movements', label: 'Mouvements' },
];

const FETCHERS = {
  stock: reportStock, stockouts: reportStockouts, sales: reportSales,
  purchases: reportPurchases, profit: reportProfit, movements: reportMovements,
};

const CSV_NAMES = {
  stock: 'rapport-stock.csv', stockouts: 'rapport-ruptures.csv', sales: 'rapport-ventes.csv',
  purchases: 'rapport-achats.csv', movements: 'rapport-mouvements.csv',
};

function Filters({ tab, filters, setFilter }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {(tab === 'stock' || tab === 'movements') && (
        <input value={filters.search || ''} onChange={(e) => setFilter('search', e.target.value)} placeholder="Rechercher…" aria-label="Recherche"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-56" />
      )}
      {(tab === 'stock') && (
        <select value={filters.status || 'all'} onChange={(e) => setFilter('status', e.target.value)} aria-label="Statut" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">Tous statuts</option>
          <option value="NORMAL">Normal</option>
          <option value="FAIBLE">Faible</option>
          <option value="RUPTURE">Rupture</option>
        </select>
      )}
      {(tab === 'sales' || tab === 'purchases') && (
        <select value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)} aria-label="Statut" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="draft">Brouillon</option>
          <option value="confirmed">Confirmé</option>
          <option value="cancelled">Annulé</option>
        </select>
      )}
      {(tab === 'sales' || tab === 'purchases' || tab === 'profit' || tab === 'movements') && (
        <>
          <input type="date" value={filters.date_from || ''} onChange={(e) => setFilter('date_from', e.target.value)} aria-label="Date début" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input type="date" value={filters.date_to || ''} onChange={(e) => setFilter('date_to', e.target.value)} aria-label="Date fin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </>
      )}
      {(tab === 'movements') && (
        <select value={filters.movement_type || ''} onChange={(e) => setFilter('movement_type', e.target.value)} aria-label="Type" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous types</option>
          <option value="initial">Initial</option>
          <option value="in">Entrées</option>
          <option value="out">Sorties</option>
          <option value="adjustment">Ajustements</option>
        </select>
      )}
    </div>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('fr-MG', { dateStyle: 'short' });
  } catch {
    return String(v);
  }
}

export default function ReportsPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState('stock');
  const [filters, setFiltersState] = useState({ status: 'all' });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  function setFilter(k, v) {
    setPage(1);
    setFiltersState((f) => ({ ...f, [k]: v }));
  }
  function switchTab(t) {
    setTab(t);
    setPage(1);
    setFiltersState(t === 'stock' ? { status: 'all' } : {});
  }

  const params = { ...filters, page, limit: 20 };
  Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] === undefined) delete params[k]; });
  const query = useQuery({ queryKey: ['reports', tab, JSON.stringify(params)], queryFn: () => FETCHERS[tab](params) });

  if (!can('reports.view')) {
    return <ErrorBox message="Accès refusé : permission reports.view requise." />;
  }

  async function onExport() {
    setExporting(true);
    try {
      const p = { ...filters };
      Object.keys(p).forEach((k) => { if (p[k] === '' || p[k] === undefined) delete p[k]; });
      await downloadCSV(`/reports/${tab}`, p, CSV_NAMES[tab]);
    } catch {
      alert('Export impossible');
    } finally {
      setExporting(false);
    }
  }

  const data = query.data?.data ?? query.data ?? [];
  const rows = Array.isArray(data) ? data : [];
  const meta = query.data?.meta;
  const summary = query.data?.summary;

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Données serveur — filtres appliqués côté PostgreSQL"
        action={
          CSV_NAMES[tab] && (
            <button disabled={exporting} onClick={onExport} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {exporting ? 'Export…' : 'Exporter CSV'}
            </button>
          )
        }
      />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary-600 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Filters tab={tab} filters={filters} setFilter={setFilter} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox message="Impossible de charger ce rapport." onRetry={() => query.refetch()} /> : (
        <>
          {summary && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="mt-1 font-bold">{/total|revenue|profit/.test(k) ? formatMGA(v) : String(v)}</p>
                </div>
              ))}
            </div>
          )}
          {tab === 'profit' && query.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Chiffre d’affaires</p><p className="mt-1 text-lg font-bold">{formatMGA(query.data.revenue)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Coût des marchandises</p><p className="mt-1 text-lg font-bold">{formatMGA(query.data.cogs)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Bénéfice brut</p><p className="mt-1 text-lg font-bold">{formatMGA(query.data.profit)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Marge</p><p className="mt-1 text-lg font-bold">{query.data.margin_percent} %</p></div>
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Aucune donnée pour ces filtres.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    {(tab === 'stock' || tab === 'stockouts') && (<><th className="px-4 py-3">Produit</th><th className="px-4 py-3 text-right">Qté</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Valeur achat</th><th className="px-4 py-3 text-right">Valeur vente</th></>)}
                    {(tab === 'sales' || tab === 'purchases') && (<><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Tiers</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total</th></>)}
                    {tab === 'movements' && (<><th className="px-4 py-3">Date</th><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Avant → Après</th><th className="px-4 py-3">Auteur</th></>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      {(tab === 'stock' || tab === 'stockouts') && (<>
                        <td className="px-4 py-3"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500">{r.sku}</div></td>
                        <td className="px-4 py-3 text-right">{r.quantity} <span className="text-xs text-slate-400">/ {r.min_stock}</span></td>
                        <td className="px-4 py-3"><StockBadge status={r.stock_status || (r.quantity === 0 ? 'RUPTURE' : 'FAIBLE')} /></td>
                        <td className="px-4 py-3 text-right">{formatMGA(BigInt(r.quantity) * BigInt(r.purchase_price))}</td>
                        <td className="px-4 py-3 text-right">{formatMGA(BigInt(r.quantity) * BigInt(r.sale_price))}</td>
                      </>)}
                      {(tab === 'sales' || tab === 'purchases') && (<>
                        <td className="px-4 py-3 font-semibold">{r.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{r.customer_name || r.supplier_name}</td>
                        <td className="px-4 py-3 text-slate-600">{r.status}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMGA(r.total)}</td>
                      </>)}
                      {tab === 'movements' && (<>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3 font-semibold">{r.product_name}</td>
                        <td className="px-4 py-3 text-slate-600">{r.movement_type}</td>
                        <td className="px-4 py-3 text-right">{r.quantity_before} → {r.quantity_after}</td>
                        <td className="px-4 py-3 text-slate-600">{r.author_name || '—'}</td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {meta && <Pagination meta={meta} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
