import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FilePlus2 } from 'lucide-react';
import { PageHeader, Loading, ErrorBox, Modal, Pagination, SearchInput, StatusBadge, EmptyState, Table, Thead, Th, Td } from '../components/common';
import { Button, Select } from '../components/ui';
import { DocForm } from '../components/DocForm';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';

// Conservé pour compatibilité d'import (DocDetail, Invoices) — préférer StatusBadge.
export const STATUS_STYLE = {
  draft: 'bg-slate-200 text-slate-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

export function makeDocPage(cfg) {
  return function DocPage() {
    const { can } = usePermissions();
    const [items, setItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [tiers, setTiers] = useState([]);
    const [products, setProducts] = useState([]);
    const [filters, setFilters] = useState({ search: '', status: '' });
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: 20 };
        if (filters.search) params.search = filters.search;
        if (filters.status) params.status = filters.status;
        const res = await cfg.api.list(params);
        setItems(res.data);
        setMeta(res.meta);
      } catch (err) {
        setError(err.response?.data?.error || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    }, [page, filters]);

    useEffect(() => {
      cfg.api.listTiers({ page: 1, limit: 100 }).then((r) => setTiers(r.data.filter((t) => t.is_active))).catch(() => {});
      cfg.api.listProducts({ page: 1, limit: 100 }).then((r) => setProducts(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
      const t = setTimeout(load, filters.search ? 300 : 0);
      return () => clearTimeout(t);
    }, [load, filters.search]);

    async function handleSubmit(payload) {
      setSubmitting(true);
      try {
        await cfg.api.create({ [cfg.tierKey]: payload.tierId, items: payload.items, discount: payload.discount, tax: payload.tax, notes: payload.notes });
        setModal(false);
        setNotice('Brouillon créé.');
        load();
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div>
        <PageHeader
          title={cfg.title}
          subtitle={cfg.subtitle}
          action={
            can(cfg.perms.create) && (
              <Button onClick={() => setModal(true)} icon={<Plus size={16} aria-hidden="true" />}>
                {cfg.createLabel.replace('+ ', '')}
              </Button>
            )
          }
        />
        {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <SearchInput value={filters.search} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, search: v })); }} placeholder="Référence, tiers…" />
          <Select value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }} aria-label="Statut">
            <option value="">Tous statuts</option>
            <option value="draft">Brouillon</option>
            <option value="confirmed">Confirmé</option>
            <option value="cancelled">Annulé</option>
          </Select>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FilePlus2 size={22} aria-hidden="true" />}
            title={`Aucun ${cfg.singular}`}
            message={`Créez votre premier ${cfg.singular} pour le retrouver ici.`}
            action={can(cfg.perms.create) && (
              <Button onClick={() => setModal(true)} icon={<Plus size={16} aria-hidden="true" />}>
                {cfg.createLabel.replace('+ ', '')}
              </Button>
            )}
          />
        ) : (
          <>
          <div className="hidden md:block">
          <Table>
            <Thead>
              <Th>Référence</Th>
              <Th>{cfg.tierLabel}</Th>
              <Th>Statut</Th>
              <Th right>Total</Th>
              <Th right>Détail</Th>
            </Thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <Td><span className="font-semibold">{d.reference}</span></Td>
                  <Td muted>{d.tier_name}</Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td right><span className="font-semibold tabular-nums">{formatMGA(d.total)}</span></Td>
                  <Td right>
                    <Link to={`${cfg.basePath}/${d.id}`} className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Ouvrir</Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
          {/* Mobile : cartes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{d.reference}</h3>
                    <p className="truncate text-xs text-slate-500">{d.tier_name}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-semibold tabular-nums">{formatMGA(d.total)}</span>
                  <Link to={`${cfg.basePath}/${d.id}`} className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Ouvrir</Link>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
        <Pagination meta={meta} onPage={setPage} />
        {modal && (
          <Modal title={cfg.createTitle} onClose={() => setModal(false)}>
            <DocForm
              tiers={tiers}
              tierLabel={cfg.tierLabel}
              products={products}
              priceKey={cfg.priceKey}
              stockHint={cfg.stockHint}
              onSearchProducts={(term) => cfg.api.listProducts({ page: 1, limit: 20, search: term }).then((r) => r.data)}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitLabel="Créer le brouillon"
            />
          </Modal>
        )}
      </div>
    );
  };
}
