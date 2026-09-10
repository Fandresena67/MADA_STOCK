import { useCallback, useEffect, useState } from 'react';
import { inventorySummary, inventoryList } from '../api/catalog';
import { formatMGA } from '../lib/format';
import { PageHeader, Loading, ErrorBox, Pagination, SearchInput, StockBadge } from '../components/common';

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
        { label: 'Produits actifs', value: String(summary.products_total) },
        { label: 'Valeur stock achat', value: formatMGA(summary.stock_value_cost) },
        { label: 'Valeur stock vente', value: formatMGA(summary.stock_value_sale) },
        { label: 'Ruptures', value: String(summary.out_of_stock) },
        { label: 'Stocks faibles', value: String(summary.low_stock) },
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
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="mt-1 text-lg font-bold">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Nom, SKU…" />
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setPage(1); setTab(t.key); }}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === t.key ? 'bg-primary-600 text-white' : 'border border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Aucun produit dans ce filtre.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3 text-right">Qté / Seuil</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Valeur achat</th>
                    <th className="px-4 py-3 text-right">Valeur vente</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.sku} · {p.category_name || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{p.quantity} / {p.min_stock}</td>
                      <td className="px-4 py-3"><StockBadge status={p.stock_status} /></td>
                      <td className="px-4 py-3 text-right">{formatMGA(p.value_cost)}</td>
                      <td className="px-4 py-3 text-right">{formatMGA(p.value_sale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
