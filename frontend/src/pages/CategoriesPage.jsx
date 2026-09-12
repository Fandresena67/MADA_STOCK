import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader, Loading, ErrorBox, Modal, Pagination, SearchInput, EmptyState, InactiveBadge } from '../components/common';
import { Button, Card } from '../components/ui';
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
            <Button onClick={() => setModal({ mode: 'create' })} icon={<Plus size={16} aria-hidden="true" />}>
              Nouvelle catégorie
            </Button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Rechercher une catégorie…" />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={22} aria-hidden="true" />}
          title="Aucune catégorie"
          message="Créez votre première catégorie pour organiser vos produits."
          action={can('categories.create') && (
            <Button onClick={() => setModal({ mode: 'create' })} icon={<Plus size={16} aria-hidden="true" />}>
              Nouvelle catégorie
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-hidden="true">
                    <FolderOpen size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500 tabular-nums">{c.products_count} produit(s)</p>
                  </div>
                </div>
                {!c.is_active && (
                  <InactiveBadge label="Désactivée" />
                )}
              </div>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description}</p>}
              <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3">
                {can('categories.update') && (
                  <button onClick={() => setModal({ mode: 'edit', item: c })} className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Modifier ${c.name}`}>
                    <Pencil size={14} aria-hidden="true" />Modifier
                  </button>
                )}
                {can('categories.delete') && (
                  <button onClick={() => handleDelete(c)} className="inline-flex items-center gap-1 rounded text-sm font-semibold text-red-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Supprimer ${c.name}`}>
                    <Trash2 size={14} aria-hidden="true" />Supprimer
                  </button>
                )}
              </div>
            </Card>
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
