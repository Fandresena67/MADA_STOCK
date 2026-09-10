import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput } from '../components/common';
import { DocForm } from '../components/DocForm';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';

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
              <button onClick={() => setModal(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                {cfg.createLabel}
              </button>
            )
          }
        />
        {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <SearchInput value={filters.search} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, search: v })); }} placeholder="Référence, tiers…" />
          <select value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Tous statuts</option>
            <option value="draft">Brouillon</option>
            <option value="confirmed">Confirmé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <Empty message={`Aucun élément. Créez votre premier ${cfg.singular}.`} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">{cfg.tierLabel}</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-semibold">{d.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{d.tier_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatMGA(d.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`${cfg.basePath}/${d.id}`} className="font-semibold text-primary-600 hover:underline">Ouvrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
