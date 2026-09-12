import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Ban } from 'lucide-react';
import { listProducts, createProduct, updateProduct, deleteProduct, listCategories, uploadProductImage, deleteProductImage, productImageSrc } from '../api/catalog';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';
import { PageHeader, Loading, ErrorBox, Modal, Pagination, SearchInput, StockBadge, Table, Thead, Th, Td, EmptyState } from '../components/common';
import { Button, ProductImage } from '../components/ui';
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

  async function handleSubmit(payload, imageAction) {
    setSubmitting(true);
    try {
      let id;
      if (modal.mode === 'create') {
        const created = await createProduct(payload);
        id = created.id;
      } else {
        await updateProduct(modal.item.id, payload);
        id = modal.item.id;
      }
      // Photo : upload/remplacement ou suppression, après le produit.
      if (imageAction?.file) await uploadProductImage(id, imageAction.file);
      else if (imageAction?.remove) await deleteProductImage(id).catch(() => {});
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
            <Button onClick={() => setModal({ mode: 'create' })} icon={<Plus size={16} aria-hidden="true" />}>
              Nouveau produit
            </Button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Nom, SKU, code-barres…" />
        <select
          value={filters.categoryId}
          onChange={(e) => setFilter('categoryId', e.target.value)}
          aria-label="Filtrer par catégorie"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-auto"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.stock}
          onChange={(e) => setFilter('stock', e.target.value)}
          aria-label="Filtrer par état du stock"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-auto"
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
        <EmptyState
          title="Aucun produit"
          message="Vous n'avez encore aucun produit dans votre inventaire."
          action={can('products.create') && (
            <Button onClick={() => setModal({ mode: 'create' })} icon={<Plus size={16} aria-hidden="true" />}>
              Ajouter un produit
            </Button>
          )}
        />
      ) : (
        <>
          {/* Desktop : tableau */}
          <div className="hidden md:block">
          <Table>
            <Thead>
              <Th>Produit</Th>
              <Th>Catégorie</Th>
              <Th right>Achat</Th>
              <Th right>Vente</Th>
              <Th right>Qté</Th>
              <Th>Statut</Th>
              <Th right>Actions</Th>
            </Thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProductImage src={productImageSrc(p.image_url)} name={p.name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold">
                          <Link to={`/app/products/${p.id}`} className="rounded outline-none hover:text-primary-600 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">{p.name}</Link>
                        </div>
                        <div className="text-xs text-slate-500">{p.sku}</div>
                      </div>
                    </div>
                  </Td>
                  <Td muted>{p.category_name || '—'}</Td>
                  <Td right muted>{formatMGA(p.purchase_price)}</Td>
                  <Td right muted>{formatMGA(p.sale_price)}</Td>
                  <Td right><span className="tabular-nums">{p.quantity}</span> <span className="text-xs text-slate-400">/ min {p.min_stock}</span></Td>
                  <Td><StockBadge status={p.stock_status} /></Td>
                  <Td right>
                    {can('products.update') && (
                      <button onClick={() => setModal({ mode: 'edit', item: p })} className="mr-3 inline-flex items-center gap-1 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Modifier ${p.name}`}>
                        <Pencil size={14} aria-hidden="true" />Modifier
                      </button>
                    )}
                    <Link to={`/app/products/${p.id}`} className="mr-3 rounded font-semibold text-slate-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                      Voir
                    </Link>
                    {can('products.delete') && (
                      <button onClick={() => handleDelete(p)} className="inline-flex items-center gap-1 rounded font-semibold text-red-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Désactiver ${p.name}`}>
                        <Ban size={14} aria-hidden="true" />Désactiver
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
          {/* Mobile : cartes */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <ProductImage src={productImageSrc(p.image_url)} name={p.name} size="sm" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">
                        <Link to={`/app/products/${p.id}`} className="rounded outline-none hover:text-primary-600 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">{p.name}</Link>
                      </h3>
                      <p className="truncate text-xs text-slate-500">{p.sku} · {p.category_name || 'Sans catégorie'}</p>
                    </div>
                  </div>
                  <StockBadge status={p.stock_status} />
                </div>
                <div className="mt-2 text-sm">
                  <p>Achat : <strong className="tabular-nums">{formatMGA(p.purchase_price)}</strong> · Vente : <strong className="tabular-nums">{formatMGA(p.sale_price)}</strong></p>
                  <p className="text-slate-600">Stock : <span className="tabular-nums">{p.quantity}</span> (min {p.min_stock})</p>
                </div>
                <div className="mt-3 flex gap-3">
                  {can('products.update') && (
                    <button onClick={() => setModal({ mode: 'edit', item: p })} className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Modifier ${p.name}`}>
                      <Pencil size={14} aria-hidden="true" />Modifier
                    </button>
                  )}
                  {can('products.delete') && (
                    <button onClick={() => handleDelete(p)} className="inline-flex items-center gap-1 rounded text-sm font-semibold text-red-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Désactiver ${p.name}`}>
                      <Ban size={14} aria-hidden="true" />Désactiver
                    </button>
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
