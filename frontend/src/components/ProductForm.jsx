import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Field, TextInput, PrimaryButton, Select, Textarea, ProductImage } from './ui';
import { productImageSrc } from '../api/catalog';
import { parseMGAInput, formatPriceInput, unformatPriceInput } from '../lib/format';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo, comme le backend
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

function validateImageFile(file) {
  if (!file) return 'Aucune image fournie.';
  const ext = `.${(file.name || '').split('.').pop().toLowerCase()}`;
  if (!IMAGE_MIME.includes(file.type) || !IMAGE_EXT.includes(ext)) {
    return 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.';
  }
  if (file.size > MAX_IMAGE_SIZE) return 'La photo ne doit pas dépasser 5 Mo.';
  if (file.size === 0) return 'Fichier invalide.';
  return '';
}

const EMPTY = {
  name: '', sku: '', description: '', category_id: '', purchase_price: '0',
  sale_price: '0', quantity: '0', min_stock: '0', unit: 'unité', barcode: '',
};

export function ProductForm({ initial, categories, onSubmit, submitting, isEdit }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...Object.fromEntries(Object.entries(initial || {}).filter(([, v]) => v !== null && v !== undefined)),
    category_id: initial?.category_id ? String(initial.category_id) : '',
    purchase_price: formatPriceInput(initial?.purchase_price ?? '0'),
    sale_price: formatPriceInput(initial?.sale_price ?? '0'),
    quantity: String(initial?.quantity ?? '0'),
    min_stock: String(initial?.min_stock ?? '0'),
  });
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef(null);

  // Nettoie l'URL d'aperçu.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function onSelectImage(e) {
    const chosen = e.target.files?.[0] || null;
    e.target.value = '';
    if (!chosen) return;
    const problem = validateImageFile(chosen);
    if (problem) {
      setImageError(problem);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(chosen);
    setImagePreview(URL.createObjectURL(chosen));
    setRemoveImage(false);
    setImageError('');
  }

  function cancelImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Prix : forme éditable au focus ("2 000 000 Ar" → "2000000"),
  // forme professionnelle au blur ("2000000" → "2 000 000 Ar").
  function focusPrice(key) {
    setForm((f) => ({ ...f, [key]: unformatPriceInput(f[key]) }));
  }

  function blurPrice(key) {
    setForm((f) => ({ ...f, [key]: formatPriceInput(f[key]) }));
  }

  async function handle(e) {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      unit: form.unit.trim() || 'unité',
      purchase_price: parseMGAInput(form.purchase_price),
      sale_price: parseMGAInput(form.sale_price),
      min_stock: Number(form.min_stock),
      category_id: form.category_id ? Number(form.category_id) : null,
    };
    if (!isEdit) payload.quantity = Number(form.quantity); // création : stock initial
    if (form.sku.trim()) payload.sku = form.sku.trim();
    if (form.barcode.trim()) payload.barcode = form.barcode.trim();
    const intFields = isEdit ? ['purchase_price', 'sale_price', 'min_stock'] : ['purchase_price', 'sale_price', 'quantity', 'min_stock'];
    for (const k of intFields) {
      if (!Number.isInteger(payload[k]) || payload[k] < 0) {
        setError(`${k} : entier positif requis`);
        return;
      }
    }
    try {
      await onSubmit(payload, imageFile ? { file: imageFile } : removeImage ? { remove: true } : null);
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  const currentImage = !imageFile && !removeImage ? productImageSrc(initial?.image_url) : null;

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label="Nom du produit" required>
        <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Photo du produit (optionnel)</span>
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={onSelectImage}
          className="sr-only"
          aria-label="Choisir une photo produit (JPG, PNG ou WEBP, 5 Mo maximum)"
        />
        <div className="flex items-center gap-3">
          {imagePreview ? (
            <img src={imagePreview} alt="Aperçu de la photo produit" className="h-16 w-16 shrink-0 rounded-lg object-cover" draggable={false} />
          ) : (
            <ProductImage src={currentImage} name={form.name} size="lg" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {imageFile && <p className="truncate text-xs text-slate-500">{imageFile.name} — envoyée à l'enregistrement.</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <Camera size={14} aria-hidden="true" />
                {currentImage || imageFile ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {imageFile ? (
                <button
                  type="button"
                  onClick={cancelImage}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <X size={14} aria-hidden="true" />
                  Annuler
                </button>
              ) : (
                currentImage && (
                  <button
                    type="button"
                    onClick={() => setRemoveImage((v) => !v)}
                    aria-pressed={removeImage}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500 ${removeImage ? 'text-slate-600' : 'text-red-600'}`}
                  >
                    <X size={14} aria-hidden="true" />
                    {removeImage ? 'Conserver la photo' : 'Supprimer la photo'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        {removeImage && !imageFile && (
          <p className="mt-1 text-xs text-amber-700" role="note">La photo sera supprimée à l'enregistrement.</p>
        )}
        {imageError && <p className="mt-1 text-sm text-red-600" role="alert">{imageError}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SKU (vide = auto)">
          <TextInput value={form.sku} onChange={(e) => set('sku', e.target.value)} maxLength={64} placeholder="P-… (auto si vide)" />
        </Field>
        <Field label="Code-barres (optionnel)">
          <TextInput value={form.barcode} onChange={(e) => set('barcode', e.target.value)} maxLength={64} />
        </Field>
      </div>
      <Field label="Catégorie">
        <Select
          value={form.category_id}
          onChange={(e) => set('category_id', e.target.value)}
        >
          <option value="">— Sans catégorie —</option>
          {(categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description (optionnel)">
        <Textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={1000}
          rows={2}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prix d'achat (Ar)" required>
          <TextInput
            required
            inputMode="numeric"
            value={form.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)}
            onFocus={() => focusPrice('purchase_price')}
            onBlur={() => blurPrice('purchase_price')}
          />
        </Field>
        <Field label="Prix de vente (Ar)" required>
          <TextInput
            required
            inputMode="numeric"
            value={form.sale_price}
            onChange={(e) => set('sale_price', e.target.value)}
            onFocus={() => focusPrice('sale_price')}
            onBlur={() => blurPrice('sale_price')}
          />
        </Field>
        {!isEdit && (
          <Field label="Quantité initiale" required>
            <TextInput required inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
        )}
        {isEdit && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700" role="note">
            Le stock ne se modifie plus ici : utilisez les entrées, sorties ou ajustements (page Mouvements).
          </p>
        )}
        <Field label="Seuil minimum" required>
          <TextInput required inputMode="numeric" value={form.min_stock} onChange={(e) => set('min_stock', e.target.value)} />
        </Field>
      </div>
      <Field label="Unité">
        <TextInput value={form.unit} onChange={(e) => set('unit', e.target.value)} maxLength={32} />
      </Field>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
    </form>
  );
}
