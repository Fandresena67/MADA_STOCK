import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Loading, ErrorBox, Pagination, SearchInput } from '../components/common';
import { superUsers, patchSuperUser } from '../api/admin';

export default function SuperUsers() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', is_active: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.is_active) params.is_active = filters.is_active;
      const res = await superUsers(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  function setFilter(k, v) {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  }

  async function toggle(item) {
    if (!window.confirm(`${item.is_active ? 'Désactiver' : 'Réactiver'} « ${item.email} » ?`)) return;
    try {
      await patchSuperUser(item.id, { is_active: !item.is_active });
      setNotice('Utilisateur mis à jour.');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle="Toutes entreprises — activation et rôles (jamais de super_admin via interface)" />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Nom, email…" />
        <select value={filters.role} onChange={(e) => setFilter('role', e.target.value)} aria-label="Rôle" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous rôles</option>
          <option value="super_admin">Super admin</option>
          <option value="company_admin">Admin entreprise</option>
          <option value="employee">Employé</option>
        </select>
        <select value={filters.is_active} onChange={(e) => setFilter('is_active', e.target.value)} aria-label="Statut" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="true">Actifs</option>
          <option value="false">Désactivés</option>
        </select>
      </div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucun utilisateur trouvé.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                  <td className="px-4 py-3 text-slate-600">{u.company_name || '— (plateforme)'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(u)} className={`font-semibold hover:underline ${u.is_active ? 'text-red-600' : 'text-emerald-600'}`}>
                      {u.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
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
