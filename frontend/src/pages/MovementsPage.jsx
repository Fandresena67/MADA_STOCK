import { useCallback, useEffect, useState } from 'react';
import { listMovements, listProducts, createEntry, createExit, createAdjustment } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { useInvalidateStats } from '../hooks/useInvalidateStats';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput } from '../components/common';
import { MovementForm, movementTitle } from '../components/MovementForm';

const TYPES = [
  { key: '', label: 'Tous' },
  { key: 'in', label: 'Entrées' },
  { key: 'out', label: 'Sorties' },
  { key: 'adjustment', label: 'Ajustements' },
  { key: 'initial', label: 'Stock initial' },
];

const TYPE_STYLE = {
  initial: 'bg-slate-200 text-slate-700',
  in: 'bg-emerald-100 text-emerald-700',
  out: 'bg-red-100 text-red-700',
  adjustment: 'bg-amber-100 text-amber-700',
};

const TYPE_LABEL = { initial: 'Initial', in: 'Entrée', out: 'Sortie', adjustment: 'Ajustement' };

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function MovementsPage() {
  const { can } = usePermissions();
  const invalidateStats = useInvalidateStats();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', product_id: '', movement_type: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'in' | 'out' | 'adjustment'
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.product_id) params.product_id = filters.product_id;
      if (filters.movement_type) params.movement_type = filters.movement_type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await listMovements(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await listProducts({ page: 1, limit: 100 });
      setProducts(res.data);
    } catch {
      // La liste des produits peut être indisponible sans permission dédiée.
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      if (modal === 'in') await createEntry(payload);
      else if (modal === 'out') await createExit(payload);
      else await createAdjustment(payload);
      setModal(null);
      setNotice('Mouvement enregistré.');
      invalidateStats();
      load();
      loadProducts();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique des entrées, sorties et ajustements"
        action={
          <div className="flex flex-wrap gap-2">
            {can('stock.in') && (
              <button onClick={() => setModal('in')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                + Entrée
              </button>
            )}
            {can('stock.out') && (
              <button onClick={() => setModal('out')} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                − Sortie
              </button>
            )}
            {can('stock.adjust') && (
              <button onClick={() => setModal('adjustment')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                Ajuster le stock
              </button>
            )}
          </div>
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Produit, motif, référence…" />
        <select value={filters.product_id} onChange={(e) => setFilter('product_id', e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous produits</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={filters.movement_type} onChange={(e) => setFilter('movement_type', e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {TYPES.map((t) => (
            <option key={t.label} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} aria-label="Date début" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} aria-label="Date fin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty message="Aucun mouvement. Enregistrez une entrée, une sortie ou un ajustement." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">Avant → Après</th>
                  <th className="px-4 py-3">Motif</th>
                  <th className="px-4 py-3">Auteur</th>
                  <th className="px-4 py-3">Référence</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{m.product_name}</div>
                      <div className="text-xs text-slate-500">{m.product_sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLE[m.movement_type]}`}>
                        {TYPE_LABEL[m.movement_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{m.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{m.quantity_before} → {m.quantity_after}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={m.reason || m.notes}>{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{m.author_name || 'Compte supprimé'}</td>
                    <td className="px-4 py-3 text-slate-600">{m.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{m.product_name}</h3>
                    <p className="text-xs text-slate-500">{formatDate(m.created_at)} · {m.author_name || 'Compte supprimé'}</p>
                  </div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLE[m.movement_type]}`}>
                    {TYPE_LABEL[m.movement_type]}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  Quantité : <strong>{m.quantity}</strong> · {m.quantity_before} → <strong>{m.quantity_after}</strong>
                </p>
                {(m.reason || m.reference) && (
                  <p className="mt-1 text-sm text-slate-600">{[m.reason, m.reference].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {modal && (
        <Modal title={movementTitle(modal)} onClose={() => setModal(null)}>
          <MovementForm mode={modal} products={products} onSubmit={handleSubmit} submitting={submitting} />
        </Modal>
      )}
    </div>
  );
}
