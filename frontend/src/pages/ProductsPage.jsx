import { useCallback, useEffect, useState } from 'react';
import { listProducts, createProduct, updateProduct, deleteProduct, listCategories } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput, StockBadge } from '../components/common';
import { ProductForm } from '../components/ProductForm';

export default function ProductsPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', categoryId: '', stock: 'all' });
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
      const params = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.stock === 'low') params.lowStock = 'true';
      if (filters.stock === 'out') params.outOfStock = 'true';
      const res = await listProducts(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    listCategories({ page: 1, limit: 100 }).then((r) => setCategories(r.data)).catch(() => {});
  }, []);

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
      if (modal.mode === 'create') await createProduct(payload);
      else await updateProduct(modal.item.id, payload);
      setModal(null);
      setNotice('Produit enregistré.');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Désactiver le produit « ${item.name} » (${item.sku}) ?`)) return;
    try {
      await deleteProduct(item.id);
      setNotice('Produit désactivé.');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle="Catalogue et stock de votre entreprise"
        action={
          can('products.create') && (
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              + Nouveau produit
            </button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Nom, SKU, code-barres…" />
        <select
          value={filters.categoryId}
          onChange={(e) => setFilter('categoryId', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.stock}
          onChange={(e) => setFilter('stock', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tous stocks</option>
          <option value="low">Stock faible</option>
          <option value="out">Rupture</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty message="Aucun produit trouvé. Créez votre premier produit avec son stock initial." />
      ) : (
        <>
          {/* Desktop : tableau */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Achat</th>
                  <th className="px-4 py-3 text-right">Vente</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category_name || '—'}</td>
                    <td className="px-4 py-3 text-right">{formatMGA(p.purchase_price)}</td>
                    <td className="px-4 py-3 text-right">{formatMGA(p.sale_price)}</td>
                    <td className="px-4 py-3 text-right">{p.quantity} <span className="text-xs text-slate-400">/ min {p.min_stock}</span></td>
                    <td className="px-4 py-3"><StockBadge status={p.stock_status} /></td>
                    <td className="px-4 py-3 text-right">
                      {can('products.update') && (
                        <button onClick={() => setModal({ mode: 'edit', item: p })} className="mr-3 font-semibold text-primary-600 hover:underline">Modifier</button>
                      )}
                      {can('products.delete') && (
                        <button onClick={() => handleDelete(p)} className="font-semibold text-red-600 hover:underline">Désactiver</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile : cartes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.sku} · {p.category_name || 'Sans catégorie'}</p>
                  </div>
                  <StockBadge status={p.stock_status} />
                </div>
                <div className="mt-2 text-sm">
                  <p>Achat : <strong>{formatMGA(p.purchase_price)}</strong> · Vente : <strong>{formatMGA(p.sale_price)}</strong></p>
                  <p className="text-slate-600">Stock : {p.quantity} (min {p.min_stock})</p>
                </div>
                <div className="mt-3 flex gap-3">
                  {can('products.update') && (
                    <button onClick={() => setModal({ mode: 'edit', item: p })} className="text-sm font-semibold text-primary-600 hover:underline">Modifier</button>
                  )}
                  {can('products.delete') && (
                    <button onClick={() => handleDelete(p)} className="text-sm font-semibold text-red-600 hover:underline">Désactiver</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Nouveau produit' : 'Modifier le produit'} onClose={() => setModal(null)}>
          <ProductForm initial={modal.item} categories={categories} onSubmit={handleSubmit} submitting={submitting} isEdit={modal.mode === 'edit'} />
        </Modal>
      )}
    </div>
  );
}
