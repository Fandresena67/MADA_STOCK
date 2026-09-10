import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Loading, ErrorBox, Pagination, SearchInput } from '../components/common';
import { superCompanies, setCompanyActive } from '../api/admin';

export default function SuperCompanies() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superCompanies({ page, limit: 20, search: search || undefined });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function toggle(item) {
    const action = item.is_active ? 'Désactiver' : 'Réactiver';
    if (!window.confirm(`${action} l'entreprise « ${item.name} » ?${item.is_active ? ' Ses utilisateurs seront bloqués immédiatement.' : ''}`)) return;
    try {
      await setCompanyActive(item.id, !item.is_active);
      setNotice(`Entreprise ${item.is_active ? 'désactivée' : 'réactivée'}.`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <div>
      <PageHeader title="Entreprises" subtitle="Activation et supervision (jamais de suppression destructive)" />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Rechercher une entreprise…" />
      </div>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucune entreprise trouvée.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Utilisateurs</th>
                <th className="px-4 py-3 text-right">Produits</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3"><div className="font-semibold">{c.name}</div><div className="text-xs text-slate-500">{c.currency} · depuis {new Date(c.created_at).toLocaleDateString('fr-MG')}</div></td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {c.is_active ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{c.users_count}</td>
                  <td className="px-4 py-3 text-right">{c.products_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(c)} className={`font-semibold hover:underline ${c.is_active ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.is_active ? 'Désactiver' : 'Réactiver'}
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
