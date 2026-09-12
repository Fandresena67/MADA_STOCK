import { useCallback, useEffect, useState } from 'react';
import { Package, Wallet, Banknote, OctagonX, TriangleAlert } from 'lucide-react';
import { inventorySummary, inventoryList } from '../api/catalog';
import { formatMGA } from '../lib/format';
import { PageHeader, Loading, ErrorBox, Pagination, SearchInput, StockBadge, Table, Thead, Th, Td, EmptyState, SegmentedGroup, FilterButton } from '../components/common';

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'FAIBLE', label: 'Stock faible' },
  { key: 'RUPTURE', label: 'Rupture' },
];

export default function InventoryPage() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, list] = await Promise.all([
        inventorySummary(),
        inventoryList({ page, limit: 20, search: search || undefined, status: tab }),
      ]);
      setSummary(s);
      setItems(list.data);
      setMeta(list.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, tab, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const cards = summary
    ? [
        { label: 'Produits actifs', value: String(summary.products_total), icon: Package, tint: 'bg-slate-100 text-slate-600' },
        { label: 'Valeur stock achat', value: formatMGA(summary.stock_value_cost), icon: Wallet, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Valeur stock vente', value: formatMGA(summary.stock_value_sale), icon: Banknote, tint: 'bg-indigo-50 text-indigo-600' },
        { label: 'Ruptures', value: String(summary.out_of_stock), icon: OctagonX, tint: 'bg-red-50 text-red-600' },
        { label: 'Stocks faibles', value: String(summary.low_stock), icon: TriangleAlert, tint: 'bg-amber-50 text-amber-600' },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Inventaire" subtitle="Vue tenant-scopée des stocks (Ariary)" />
      {loading && !summary ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.tint}`} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-slate-500">{c.label}</span>
                    <span className="block truncate text-lg font-bold leading-tight">{c.value}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Nom, SKU…" />
            <SegmentedGroup label="Filtrer par état du stock">
              {TABS.map((t) => (
                <FilterButton key={t.key} active={tab === t.key} onClick={() => { setPage(1); setTab(t.key); }}>
                  {t.label}
                </FilterButton>
              ))}
            </SegmentedGroup>
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={<Package size={22} aria-hidden="true" />}
              title="Aucun produit dans ce filtre"
              message="Modifiez le filtre ou la recherche pour voir d'autres produits."
            />
          ) : (
            <Table>
              <Thead>
                <Th>Produit</Th>
                <Th right>Qté / Seuil</Th>
                <Th>Statut</Th>
                <Th right>Valeur achat</Th>
                <Th right>Valeur vente</Th>
              </Thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                    <Td>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.sku} · {p.category_name || '—'}</div>
                    </Td>
                    <Td right><span className="tabular-nums">{p.quantity} / {p.min_stock}</span></Td>
                    <Td><StockBadge status={p.stock_status} /></Td>
                    <Td right muted><span className="tabular-nums">{formatMGA(p.value_cost)}</span></Td>
                    <Td right><span className="font-semibold tabular-nums">{formatMGA(p.value_sale)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
