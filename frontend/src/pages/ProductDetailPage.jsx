import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Camera, Trash2, Package, ChartBar, History } from 'lucide-react';
import {
  getProduct, getProductStats, updateProduct, uploadProductImage, deleteProductImage, productImageSrc, listCategories,
  listMovements,
} from '../api/catalog';
import { PageHeader, Loading, ErrorBox, Modal, MovementBadge, StockBadge, EmptyState, Table, Thead, Th, Td } from '../components/common';
import { Button, Card, CardTitle, ProductImage } from '../components/ui';
import { ProductForm } from '../components/ProductForm';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';

function Stat({ label, value, money }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums text-slate-800" title={String(value)}>
        {money ? formatMGA(value) : value}
      </p>
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(null);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, s, m] = await Promise.all([
        getProduct(id),
        getProductStats(id).catch(() => null),
        listMovements({ product_id: id, page: 1, limit: 10 }).catch(() => ({ data: [] })),
      ]);
      setProduct(p);
      setStats(s);
      setMoves(m.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    listCategories({ page: 1, limit: 100 }).then((r) => setCategories(r.data)).catch(() => {});
  }, [load]);

  async function onPickImage(e) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    setPhotoError('');
    try {
      const updated = await uploadProductImage(id, file);
      setProduct((p) => (p ? { ...p, image_url: updated.image_url } : p));
      setNotice('Photo du produit mise à jour.');
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Envoi impossible. Réessayez.');
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveImage() {
    if (!window.confirm('Supprimer la photo de ce produit ?')) return;
    setPhotoError('');
    try {
      await deleteProductImage(id);
      setProduct((p) => (p ? { ...p, image_url: null } : p));
      setNotice('Photo du produit supprimée.');
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Suppression impossible.');
    }
  }

  async function handleEdit(payload, imageAction) {
    setSubmitting(true);
    try {
      const updated = await updateProduct(id, payload);
      let imageUrl = updated.image_url;
      if (imageAction?.file) imageUrl = (await uploadProductImage(id, imageAction.file)).image_url;
      else if (imageAction?.remove) {
        await deleteProductImage(id).catch(() => {});
        imageUrl = null;
      }
      setProduct((p) => (p ? { ...p, ...updated, image_url: imageUrl } : p));
      setModal(false);
      setNotice('Produit enregistré.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!product) return null;

  return (
    <div>
      <button onClick={() => navigate('/app/products')} className="mb-4 inline-flex items-center gap-1 rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
        <ArrowLeft size={16} aria-hidden="true" />Retour aux produits
      </button>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku}${product.category_name ? ` · ${product.category_name}` : ''}`}
        action={
          can('products.update') && (
            <Button variant="outline" onClick={() => setModal(true)} icon={<Pencil size={15} aria-hidden="true" />}>
              Modifier
            </Button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="flex flex-col items-center gap-3">
              <ProductImage src={productImageSrc(product.image_url)} name={product.name} size="lg" />
              {can('products.update') && (
                <div className="flex flex-wrap justify-center gap-2">
                  <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} onChange={onPickImage} className="sr-only" aria-label="Choisir une photo produit (JPG, PNG ou WEBP, 5 Mo maximum)" />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading} icon={<Camera size={14} aria-hidden="true" />}>
                    {product.image_url ? 'Changer la photo' : 'Ajouter une photo'}
                  </Button>
                  {product.image_url && (
                    <Button size="sm" variant="dangerOutline" onClick={onRemoveImage} icon={<Trash2 size={14} aria-hidden="true" />}>
                      Supprimer
                    </Button>
                  )}
                </div>
              )}
              {photoError && <p className="text-center text-sm text-red-600" role="alert">{photoError}</p>}
            </div>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">SKU</dt><dd className="font-semibold">{product.sku}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Code-barres</dt><dd className="font-semibold">{product.barcode || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Catégorie</dt><dd className="font-semibold">{product.category_name || 'Sans catégorie'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Unité</dt><dd className="font-semibold">{product.unit}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardTitle>Prix</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Achat</dt><dd className="font-semibold tabular-nums">{formatMGA(product.purchase_price)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Vente</dt><dd className="font-semibold tabular-nums">{formatMGA(product.sale_price)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Marge indicative</dt><dd className="font-semibold tabular-nums">{formatMGA(product.margin)}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardTitle>Stock</CardTitle>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold tabular-nums">{product.quantity}</p>
              <StockBadge status={product.stock_status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">Minimum : <span className="font-semibold tabular-nums">{product.min_stock}</span></p>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle action={<Package size={18} aria-hidden="true" className="text-slate-400" />}>
              Description
            </CardTitle>
            <p className="text-sm text-slate-600">{product.description || 'Aucune description.'}</p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <div>Créé le : <span className="font-semibold text-slate-700">{formatDateTime(product.created_at)}</span></div>
              <div>Modifié le : <span className="font-semibold text-slate-700">{formatDateTime(product.updated_at)}</span></div>
            </dl>
          </Card>
          <Card>
            <CardTitle action={<ChartBar size={18} aria-hidden="true" className="text-slate-400" />}>
              Statistiques
            </CardTitle>
            {!stats ? (
              <p className="text-sm text-slate-500">Statistiques indisponibles.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Vendues" value={`${stats.quantity_sold} unité(s)`} />
                <Stat label="Achetées" value={`${stats.quantity_purchased} unité(s)`} />
                <Stat label="Ventes" value={stats.sales_count} />
                <Stat label="Achats" value={stats.purchases_count} />
                <Stat label="CA généré" value={stats.revenue} money />
                <Stat label="Profit généré" value={stats.profit} money />
                <Stat label="Valeur du stock" value={stats.stock_value} money />
              </div>
            )}
          </Card>
          <Card>
            <CardTitle action={<History size={18} aria-hidden="true" className="text-slate-400" />}>
              Historique des mouvements
            </CardTitle>
            {moves.length === 0 ? (
              <EmptyState title="Aucun mouvement" message="Les entrées, sorties et ajustements de ce produit apparaîtront ici." />
            ) : (
              <Table minWidth="min-w-[560px]">
                <Thead>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th right>Qté</Th>
                  <Th right>Avant → Après</Th>
                  <Th>Motif</Th>
                </Thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <Td muted><span className="whitespace-nowrap">{formatDateTime(m.created_at)}</span></Td>
                      <Td><MovementBadge type={m.movement_type} /></Td>
                      <Td right><span className="font-semibold tabular-nums">{m.quantity}</span></Td>
                      <Td right muted><span className="whitespace-nowrap tabular-nums">{m.quantity_before} → {m.quantity_after}</span></Td>
                      <Td muted><span className="block max-w-[200px] truncate" title={m.reason}>{m.reason || '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
      {modal && (
        <Modal title="Modifier le produit" onClose={() => setModal(false)}>
          <ProductForm initial={product} categories={categories} onSubmit={handleEdit} submitting={submitting} isEdit />
        </Modal>
      )}
    </div>
  );
}
