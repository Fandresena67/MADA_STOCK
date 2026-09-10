import { useState } from 'react';
import { Field, TextInput, PrimaryButton } from './ui';

const TITLES = {
  in: 'Nouvelle entrée de stock',
  out: 'Nouvelle sortie de stock',
  adjustment: 'Ajuster le stock',
};

const SUBMITS = {
  in: 'Enregistrer l’entrée',
  out: 'Enregistrer la sortie',
  adjustment: 'Appliquer l’ajustement',
};

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MovementForm({ mode, products, onSubmit, submitting }) {
  const [form, setForm] = useState({ product_id: '', quantity: '', reason: '', reference: '', notes: '' });
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selected = products.find((p) => String(p.id) === String(form.product_id));
  const qty = Number(form.quantity);
  const validQty = Number.isInteger(qty) && (mode === 'adjustment' ? qty >= 0 : qty > 0);
  const delta = selected && validQty ? (mode === 'adjustment' ? qty - selected.quantity : mode === 'in' ? qty : -qty) : null;

  async function handle(e) {
    e.preventDefault();
    setError('');
    if (!form.product_id) {
      setError('Produit requis');
      return;
    }
    if (!validQty) {
      setError(mode === 'adjustment' ? 'Nouveau stock : entier ≥ 0 requis' : 'Quantité : entier > 0 requis');
      return;
    }
    try {
      await onSubmit({
        product_id: Number(form.product_id),
        quantity: qty,
        reason: form.reason.trim(),
        reference: form.reference.trim(),
        notes: form.notes.trim(),
        idempotency_key: newIdempotencyKey(), // anti double-clic / rejeu réseau
      });
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label="Produit *">
        <select
          value={form.product_id}
          onChange={(e) => set('product_id', e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
        >
          <option value="">— Choisir un produit —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) — stock : {p.quantity}
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600" role="status">
          Stock disponible : <strong>{selected.quantity}</strong>
          {delta !== null && (
            <span>
              {' '}→ Nouveau : <strong>{selected.quantity + delta}</strong> (
              <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {delta >= 0 ? `+${delta}` : delta}
              </span>
              )
            </span>
          )}
        </p>
      )}
      <Field label={mode === 'adjustment' ? 'Nouveau stock *' : 'Quantité *'}>
        <TextInput required inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
      </Field>
      <Field label={mode === 'adjustment' ? 'Motif *' : 'Motif'}>
        <TextInput
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
          maxLength={200}
          placeholder={mode === 'in' ? 'Réception fournisseur…' : mode === 'out' ? 'Vente, perte…' : 'Inventaire physique…'}
        />
      </Field>
      <Field label="Référence">
        <TextInput value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={64} placeholder="REC-2026-001" />
      </Field>
      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : SUBMITS[mode]}</PrimaryButton>
    </form>
  );
}

export function movementTitle(mode) {
  return TITLES[mode];
}
