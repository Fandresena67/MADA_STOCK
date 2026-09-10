import { useCallback, useEffect, useState } from 'react';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput } from '../components/common';
import { CategoryForm } from '../components/CategoryForm';

export default function CategoriesPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // {mode:'create'|'edit', item?}
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listCategories({ page, limit: 20, search: search || undefined });
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

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      if (modal.mode === 'create') await createCategory(payload);
      else await updateCategory(modal.item.id, payload);
      setModal(null);
      setNotice('Catégorie enregistrée.');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Supprimer la catégorie « ${item.name} » ?`)) return;
    try {
      await deleteCategory(item.id);
      setNotice('Catégorie supprimée.');
      load();
    } catch (err) {
      setNotice('');
      alert(err.response?.data?.error || 'Suppression impossible');
    }
  }

  return (
    <div>
      <PageHeader
        title="Catégories"
        subtitle="Organisez votre catalogue par entreprise"
        action={
          can('categories.create') && (
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              + Nouvelle catégorie
            </button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Rechercher une catégorie…" />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty message="Aucune catégorie. Créez votre première catégorie pour organiser vos produits." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{c.products_count} produit(s)</p>
                </div>
                {!c.is_active && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Désactivée</span>
                )}
              </div>
              {c.description && <p className="mt-2 text-sm text-slate-600">{c.description}</p>}
              <div className="mt-3 flex gap-2">
                {can('categories.update') && (
                  <button onClick={() => setModal({ mode: 'edit', item: c })} className="text-sm font-semibold text-primary-600 hover:underline">
                    Modifier
                  </button>
                )}
                {can('categories.delete') && (
                  <button onClick={() => handleDelete(c)} className="text-sm font-semibold text-red-600 hover:underline">
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Nouvelle catégorie' : 'Modifier la catégorie'} onClose={() => setModal(null)}>
          <CategoryForm initial={modal.item} onSubmit={handleSubmit} submitting={submitting} />
        </Modal>
      )}
    </div>
  );
}
