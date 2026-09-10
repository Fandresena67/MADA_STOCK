import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Loading, ErrorBox, Pagination } from '../components/common';
import { superAudit } from '../api/admin';

export default function SuperAudit() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ action: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (filters.action) params.action = filters.action;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await superAudit(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  function setFilter(k, v) {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  }

  return (
    <div>
      <PageHeader title="Audit global" subtitle="Événements sensibles — toutes entreprises (aucun secret exposé)" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input value={filters.action} onChange={(e) => setFilter('action', e.target.value)} placeholder="Action (ex. AUTH_LOGIN_FAILED)" aria-label="Action"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-64" />
        <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} aria-label="Date début" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} aria-label="Date fin" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucune activité.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Entité</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(a.created_at).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-3 text-slate-600">{a.user_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.company_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.entity_type ? `${a.entity_type} #${a.entity_id}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
