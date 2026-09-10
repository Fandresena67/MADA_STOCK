import { useState } from 'react';
import { Field, TextInput, PrimaryButton } from './ui';

const EMPTY = {
  name: '', sku: '', description: '', category_id: '', purchase_price: '0',
  sale_price: '0', quantity: '0', min_stock: '0', unit: 'unité', barcode: '',
};

export function ProductForm({ initial, categories, onSubmit, submitting, isEdit }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...Object.fromEntries(Object.entries(initial || {}).filter(([, v]) => v !== null && v !== undefined)),
    category_id: initial?.category_id ? String(initial.category_id) : '',
    purchase_price: String(initial?.purchase_price ?? '0'),
    sale_price: String(initial?.sale_price ?? '0'),
    quantity: String(initial?.quantity ?? '0'),
    min_stock: String(initial?.min_stock ?? '0'),
  });
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handle(e) {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      unit: form.unit.trim() || 'unité',
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
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
      await onSubmit(payload);
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label="Nom du produit">
        <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SKU (vide = auto)">
          <TextInput value={form.sku} onChange={(e) => set('sku', e.target.value)} maxLength={64} placeholder="P-… (auto si vide)" />
        </Field>
        <Field label="Code-barres (optionnel)">
          <TextInput value={form.barcode} onChange={(e) => set('barcode', e.target.value)} maxLength={64} />
        </Field>
      </div>
      <Field label="Catégorie">
        <select
          value={form.category_id}
          onChange={(e) => set('category_id', e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
        >
          <option value="">— Sans catégorie —</option>
          {(categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description (optionnel)">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prix d'achat (Ar)">
          <TextInput required inputMode="numeric" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} />
        </Field>
        <Field label="Prix de vente (Ar)">
          <TextInput required inputMode="numeric" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
        </Field>
        {!isEdit && (
          <Field label="Quantité initiale">
            <TextInput required inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </Field>
        )}
        {isEdit && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Le stock ne se modifie plus ici : utilisez les entrées, sorties ou ajustements (page Mouvements).
          </p>
        )}
        <Field label="Seuil minimum">
          <TextInput required inputMode="numeric" value={form.min_stock} onChange={(e) => set('min_stock', e.target.value)} />
        </Field>
      </div>
      <Field label="Unité">
        <TextInput value={form.unit} onChange={(e) => set('unit', e.target.value)} maxLength={32} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
    </form>
  );
}
