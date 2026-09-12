import { useCallback, useEffect, useState } from 'react';
import { Plus, Minus, SlidersHorizontal, History } from 'lucide-react';
import { listMovements, listProducts, createEntry, createExit, createAdjustment } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { useInvalidateStats } from '../hooks/useInvalidateStats';
import { PageHeader, Loading, ErrorBox, Modal, Pagination, SearchInput, MovementBadge, EmptyState, Table, Thead, Th, Td } from '../components/common';
import { Button } from '../components/ui';
import { MovementForm, movementTitle } from '../components/MovementForm';

const TYPES = [
  { key: '', label: 'Tous' },
  { key: 'in', label: 'Entrées' },
  { key: 'out', label: 'Sorties' },
  { key: 'adjustment', label: 'Ajustements' },
  { key: 'initial', label: 'Stock initial' },
];

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
              <Button variant="success" onClick={() => setModal('in')} icon={<Plus size={16} aria-hidden="true" />}>
                Entrée
              </Button>
            )}
            {can('stock.out') && (
              <Button variant="danger" onClick={() => setModal('out')} icon={<Minus size={16} aria-hidden="true" />}>
                Sortie
              </Button>
            )}
            {can('stock.adjust') && (
              <Button variant="warning" onClick={() => setModal('adjustment')} icon={<SlidersHorizontal size={16} aria-hidden="true" />}>
                Ajuster
              </Button>
            )}
          </div>
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] xl:gap-4">
        <div className="min-w-0 [&>div]:w-full [&_input]:h-10">
          <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Produit, motif, référence…" />
        </div>
        <select value={filters.product_id} onChange={(e) => setFilter('product_id', e.target.value)} aria-label="Filtrer par produit" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
          <option value="">Tous produits</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={filters.movement_type} onChange={(e) => setFilter('movement_type', e.target.value)} aria-label="Filtrer par type de mouvement" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">
          {TYPES.map((t) => (
            <option key={t.label} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} aria-label="Date début" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} aria-label="Date fin" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History size={22} aria-hidden="true" />}
          title="Aucun mouvement"
          message="Enregistrez une entrée, une sortie ou un ajustement pour alimenter l'historique."
        />
      ) : (
        <>
          <div className="hidden md:block">
          <Table minWidth="min-w-[760px]">
            <Thead>
              <Th>Date</Th>
              <Th>Produit</Th>
              <Th>Type</Th>
              <Th right>Qté</Th>
              <Th right>Avant → Après</Th>
              <Th>Motif</Th>
              <Th>Auteur</Th>
              <Th>Référence</Th>
            </Thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <Td muted><span className="whitespace-nowrap">{formatDate(m.created_at)}</span></Td>
                  <Td>
                    <div className="font-semibold">{m.product_name}</div>
                    <div className="text-xs text-slate-500">{m.product_sku}</div>
                  </Td>
                  <Td><MovementBadge type={m.movement_type} /></Td>
                  <Td right><span className="font-semibold tabular-nums">{m.quantity}</span></Td>
                  <Td right muted><span className="whitespace-nowrap tabular-nums">{m.quantity_before} → {m.quantity_after}</span></Td>
                  <Td muted><span className="block max-w-[200px] truncate" title={m.reason || m.notes}>{m.reason || '—'}</span></Td>
                  <Td muted>{m.author_name || 'Compte supprimé'}</Td>
                  <Td muted>{m.reference || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{m.product_name}</h3>
                    <p className="text-xs text-slate-500">{formatDate(m.created_at)} · {m.author_name || 'Compte supprimé'}</p>
                  </div>
                  <MovementBadge type={m.movement_type} />
                </div>
                <p className="mt-2 text-sm">
                  Quantité : <strong className="tabular-nums">{m.quantity}</strong> · <span className="tabular-nums">{m.quantity_before} → {m.quantity_after}</span>
                </p>
                {(m.reason || m.reference) && (
                  <p className="mt-1 truncate text-sm text-slate-600">{[m.reason, m.reference].filter(Boolean).join(' · ')}</p>
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
