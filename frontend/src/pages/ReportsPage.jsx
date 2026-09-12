import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ClipboardList } from 'lucide-react';
import { PageHeader, Loading, ErrorBox, Pagination, EmptyState, MovementBadge, Table, Thead, Th, Td, StatusBadge, SearchInput, SegmentedGroup, FilterButton } from '../components/common';
import { StockBadge } from '../components/common';
import { Button, Card } from '../components/ui';
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
        <SearchInput value={filters.search || ''} onChange={(v) => setFilter('search', v)} placeholder="Rechercher…" ariaLabel="Recherche" />
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
            <Button variant="outline" loading={exporting} onClick={onExport} icon={<Download size={16} aria-hidden="true" />}>
              Exporter CSV
            </Button>
          )
        }
      />
      <SegmentedGroup label="Choisir un rapport">
        {TABS.map((t) => (
          <FilterButton key={t.key} active={tab === t.key} onClick={() => switchTab(t.key)}>
            {t.label}
          </FilterButton>
        ))}
      </SegmentedGroup>
      <Filters tab={tab} filters={filters} setFilter={setFilter} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox message="Impossible de charger ce rapport." onRetry={() => query.refetch()} /> : (
        <>
          {summary && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(summary).map(([k, v]) => (
                <Card key={k} className="!p-3">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="mt-1 font-bold tabular-nums">{/total|revenue|profit/.test(k) ? formatMGA(v) : String(v)}</p>
                </Card>
              ))}
            </div>
          )}
          {tab === 'profit' && query.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="!p-4"><p className="text-xs text-slate-500">Chiffre d’affaires</p><p className="mt-1 text-lg font-bold tabular-nums">{formatMGA(query.data.revenue)}</p></Card>
              <Card className="!p-4"><p className="text-xs text-slate-500">Coût des marchandises</p><p className="mt-1 text-lg font-bold tabular-nums">{formatMGA(query.data.cogs)}</p></Card>
              <Card className="!p-4"><p className="text-xs text-slate-500">Bénéfice brut</p><p className="mt-1 text-lg font-bold tabular-nums">{formatMGA(query.data.profit)}</p></Card>
              <Card className="!p-4"><p className="text-xs text-slate-500">Marge</p><p className="mt-1 text-lg font-bold tabular-nums">{query.data.margin_percent} %</p></Card>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={22} aria-hidden="true" />}
              title="Aucune donnée"
              message="Aucune donnée pour ces filtres. Essayez d'élargir la période ou de changer de filtre."
            />
          ) : (
            <Table>
              <Thead>
                {(tab === 'stock' || tab === 'stockouts') && (<><Th>Produit</Th><Th right>Qté</Th><Th>Statut</Th><Th right>Valeur achat</Th><Th right>Valeur vente</Th></>)}
                {(tab === 'sales' || tab === 'purchases') && (<><Th>Référence</Th><Th>Tiers</Th><Th>Statut</Th><Th>Date</Th><Th right>Total</Th></>)}
                {tab === 'movements' && (<><Th>Date</Th><Th>Produit</Th><Th>Type</Th><Th right>Avant → Après</Th><Th>Auteur</Th></>)}
              </Thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                    {(tab === 'stock' || tab === 'stockouts') && (<>
                      <Td><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500">{r.sku}</div></Td>
                      <Td right><span className="tabular-nums">{r.quantity}</span> <span className="text-xs text-slate-400">/ {r.min_stock}</span></Td>
                      <Td><StockBadge status={r.stock_status || (r.quantity === 0 ? 'RUPTURE' : 'FAIBLE')} /></Td>
                      <Td right muted><span className="tabular-nums">{formatMGA(BigInt(r.quantity) * BigInt(r.purchase_price))}</span></Td>
                      <Td right><span className="tabular-nums">{formatMGA(BigInt(r.quantity) * BigInt(r.sale_price))}</span></Td>
                    </>)}
                    {(tab === 'sales' || tab === 'purchases') && (<>
                      <Td><span className="font-semibold">{r.reference}</span></Td>
                      <Td muted>{r.customer_name || r.supplier_name}</Td>
                      <Td><StatusBadge status={r.status} labels={{ draft: 'BROUILLON', confirmed: 'CONFIRMÉ', cancelled: 'ANNULÉ' }} /></Td>
                      <Td muted>{fmtDate(r.created_at)}</Td>
                      <Td right><span className="font-semibold tabular-nums">{formatMGA(r.total)}</span></Td>
                    </>)}
                    {tab === 'movements' && (<>
                      <Td muted><span className="whitespace-nowrap">{fmtDate(r.created_at)}</span></Td>
                      <Td><span className="font-semibold">{r.product_name}</span></Td>
                      <Td><MovementBadge type={r.movement_type} /></Td>
                      <Td right><span className="tabular-nums">{r.quantity_before} → {r.quantity_after}</span></Td>
                      <Td muted>{r.author_name || '—'}</Td>
                    </>)}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {meta && <Pagination meta={meta} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
