import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput } from '../components/common';
import { TierForm } from '../components/TierForm';
import { usePermissions } from '../hooks/usePermissions';

export function makeTierPage({ title, subtitle, createLabel, api, managePerm }) {
  return function TierPage() {
    const { can } = usePermissions();
    const [items, setItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.list({ page, limit: 20, search: search || undefined });
        setItems(showInactive ? res.data : res.data.filter((t) => t.is_active));
        setMeta(res.meta);
      } catch (err) {
        setError(err.response?.data?.error || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    }, [page, search, showInactive]);

    useEffect(() => {
      const t = setTimeout(load, search ? 300 : 0);
      return () => clearTimeout(t);
    }, [load, search]);

    async function handleSubmit(payload) {
      setSubmitting(true);
      try {
        if (modal.mode === 'create') await api.create(payload);
        else await api.update(modal.item.id, payload);
        setModal(null);
        setNotice('Enregistré.');
        load();
      } finally {
        setSubmitting(false);
      }
    }

    async function toggleActive(item) {
      const action = item.is_active ? 'désactiver' : 'réactiver';
      if (!window.confirm(`${action === 'désactiver' ? 'Désactiver' : 'Réactiver'} « ${item.name} » ?`)) return;
      try {
        await api.update(item.id, { is_active: !item.is_active });
        setNotice('Statut mis à jour.');
        load();
      } catch (err) {
        alert(err.response?.data?.error || 'Opération impossible');
      }
    }

    return (
      <div>
        <PageHeader
          title={title}
          subtitle={subtitle}
          action={
            can(managePerm) && (
              <button
                onClick={() => setModal({ mode: 'create' })}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {createLabel}
              </button>
            )
          }
        />
        {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Nom, email, téléphone…" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Afficher les désactivés
          </label>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <Empty message="Aucun élément." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{t.name}</h3>
                  {!t.is_active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Désactivé</span>}
                </div>
                {(t.email || t.phone) && <p className="mt-1 text-sm text-slate-500">{[t.email, t.phone].filter(Boolean).join(' · ')}</p>}
                {t.address && <p className="mt-1 text-sm text-slate-600">{t.address}</p>}
                {can(managePerm) && (
                  <div className="mt-3 flex gap-3">
                    <button onClick={() => setModal({ mode: 'edit', item: t })} className="text-sm font-semibold text-primary-600 hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => toggleActive(t)} className="text-sm font-semibold text-amber-600 hover:underline">
                      {t.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination meta={meta} onPage={setPage} />
        {modal && (
          <Modal title={modal.mode === 'create' ? createLabel.replace('+ ', '') : 'Modifier'} onClose={() => setModal(null)}>
            <TierForm initial={modal.item} onSubmit={handleSubmit} submitting={submitting} />
          </Modal>
        )}
      </div>
    );
  };
}
