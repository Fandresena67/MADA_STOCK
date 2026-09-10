import { useState } from 'react';
import { Field, PrimaryButton } from './ui';
import { formatMGA } from '../lib/format';

function calcPreview(lines, docDiscount, docTax) {
  let sub = 0, disc = 0, tax = 0;
  const rows = lines.map((l) => {
    const q = Number(l.quantity) || 0, u = Number(l.unit_price) || 0, d = Number(l.discount) || 0, t = Number(l.tax) || 0;
    const lt = Math.max(0, q * u - d) + t;
    sub += q * u; disc += d; tax += t;
    return lt;
  });
  const total = Math.max(0, sub - disc - (Number(docDiscount) || 0)) + tax + (Number(docTax) || 0);
  return { rows, subtotal: sub, total };
}

export function DocLinesEditor({ products, priceKey, lines, setLines, stockHint }) {
  function setLine(i, key, value) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: '1', unit_price: '0', discount: '0', tax: '0' }]);
  }

  function onProduct(i, pid) {
    const p = products.find((x) => String(x.id) === String(pid));
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, product_id: pid, unit_price: p ? String(p[priceKey] ?? 0) : l.unit_price } : l)));
  }

  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const p = products.find((x) => String(x.id) === String(l.product_id));
        return (
          <div key={i} className="rounded-lg border border-slate-200 p-3">
            <select
              value={l.product_id}
              onChange={(e) => onProduct(i, e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              aria-label={`Produit ligne ${i + 1}`}
            >
              <option value="">— Produit —</option>
              {products.map((x) => (
                <option key={x.id} value={x.id}>{x.name} ({x.sku}){stockHint ? ` — stock ${x.quantity}` : ''}</option>
              ))}
            </select>
            {p && stockHint && <p className="mt-1 text-xs text-slate-500">Stock disponible : {p.quantity}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs">Qté<input inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
              <label className="text-xs">P.U. (Ar)<input inputMode="numeric" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
              <label className="text-xs">Remise<input inputMode="numeric" value={l.discount} onChange={(e) => setLine(i, 'discount', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
              <label className="text-xs">Taxe<input inputMode="numeric" value={l.tax} onChange={(e) => setLine(i, 'tax', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" /></label>
            </div>
            {lines.length > 1 && (
              <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="mt-2 text-xs font-semibold text-red-600 hover:underline">
                Retirer cette ligne
              </button>
            )}
          </div>
        );
      })}
      <button type="button" onClick={addLine} className="text-sm font-semibold text-primary-600 hover:underline">
        + Ajouter une ligne
      </button>
    </div>
  );
}

export function DocForm({ tiers, tierLabel, products, priceKey, stockHint, onSubmit, submitting, submitLabel }) {
  const [tierId, setTierId] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: '1', unit_price: '0', discount: '0', tax: '0' }]);
  const [docDiscount, setDocDiscount] = useState('0');
  const [docTax, setDocTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const preview = calcPreview(lines, docDiscount, docTax);

  async function handle(e) {
    e.preventDefault();
    setError('');
    if (!tierId) {
      setError(`${tierLabel} requis`);
      return;
    }
    const items = [];
    for (const l of lines) {
      const q = Number(l.quantity), u = Number(l.unit_price), d = Number(l.discount) || 0, t = Number(l.tax) || 0;
      if (!l.product_id || !Number.isInteger(q) || q <= 0 || !Number.isInteger(u) || u < 0 || d < 0 || t < 0) {
        setError('Chaque ligne : produit, quantité entière > 0, montants ≥ 0');
        return;
      }
      items.push({ product_id: Number(l.product_id), quantity: q, unit_price: u, discount: d, tax: t });
    }
    try {
      await onSubmit({ tierId: Number(tierId), items, discount: Number(docDiscount) || 0, tax: Number(docTax) || 0, notes: notes.trim() });
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label={`${tierLabel} *`}>
        <select value={tierId} onChange={(e) => setTierId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">— Choisir —</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Lignes *</span>
        <DocLinesEditor products={products} priceKey={priceKey} lines={lines} setLines={setLines} stockHint={stockHint} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Remise globale (Ar)">
          <input inputMode="numeric" value={docDiscount} onChange={(e) => setDocDiscount(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </Field>
        <Field label="Taxe globale (Ar)">
          <input inputMode="numeric" value={docTax} onChange={(e) => setDocTax(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500" />
      </Field>
      <div className="rounded-lg bg-slate-50 p-3 text-sm" role="status">
        Sous-total : <strong>{formatMGA(preview.subtotal)}</strong> · Total estimé : <strong>{formatMGA(preview.total)}</strong>
        <span className="block text-xs text-slate-500">Calcul indicatif — le serveur recalcule.</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : submitLabel}</PrimaryButton>
    </form>
  );
}
