import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Field, TextInput, PrimaryButton, Select, Textarea, ProductImage } from './ui';
import { formatMGA } from '../lib/format';
import { productImageSrc } from '../api/catalog';

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

/**
 * Recherche produit rapide (nom, SKU, code-barres via API existante).
 * Liste préchargée en repli immédiat, recherche serveur ciblée (limit 20),
 * clavier : ↓/↑ + Entrée + Échap. Produits inactifs exclus.
 */
export function ProductPicker({ products, priceKey, stockHint, value, onPick, onSearch, inputId }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const selected = (products || []).find((x) => String(x.id) === String(value)) || results.find((x) => String(x.id) === String(value)) || null;

  const activePool = (products || []).filter((p) => p.is_active !== false);

  // Recherche serveur ciblée (debounce) ; repli = préchargés filtrés localement.
  useEffect(() => {
    const q = term.trim();
    if (!open) return;
    if (q.length < 2 || !onSearch) {
      const low = q.toLowerCase();
      setResults(
        activePool
          .filter((p) => !low || p.name.toLowerCase().includes(low) || (p.sku || '').toLowerCase().includes(low))
          .slice(0, 10)
      );
      setHighlight(0);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      onSearch(q)
        .then((items) => {
          setResults((items || []).filter((p) => p.is_active !== false).slice(0, 20));
          setHighlight(0);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [term, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function choose(p) {
    if (!p) return;
    onPick(p);
    setOpen(false);
    setTerm('');
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[highlight]) {
        e.preventDefault();
        choose(results[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={inputId ? `${inputId}-list` : undefined}
          aria-activedescendant={open && results[highlight] ? `opt-${results[highlight].id}` : undefined}
          autoComplete="off"
          placeholder={selected ? `${selected.name} (${selected.sku})` : 'Rechercher un produit (nom, SKU)…'}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
        />
      </div>
      {!selected && !term && <p className="mt-1 text-xs text-slate-400">Tapez au moins 2 lettres pour chercher dans tout le catalogue.</p>}
      {open && (
        <ul
          id={inputId ? `${inputId}-list` : undefined}
          role="listbox"
          aria-label="Produits correspondants"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {searching && (
            <li className="px-3 py-2 text-xs text-slate-400" role="status">Recherche…</li>
          )}
          {!searching && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">Aucun produit trouvé.</li>
          )}
          {results.map((p, i) => (
            <li
              key={p.id}
              id={`opt-${p.id}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-none ${i === highlight ? 'bg-primary-50' : ''}`}
            >
              <ProductImage src={productImageSrc(p.image_url)} name={p.name} size="sm" className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">{p.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {p.sku}
                  {stockHint && ` · Stock ${p.quantity}`}
                  {` · ${formatMGA(p[priceKey] ?? 0)}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocLinesEditor({ products, priceKey, lines, setLines, stockHint, onSearchProducts }) {
  function setLine(i, key, value) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: '1', unit_price: '0', discount: '0', tax: '0' }]);
  }

  function onProduct(i, pid) {
    const pool = products || [];
    const p = pool.find((x) => String(x.id) === String(pid));
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, product_id: pid, unit_price: p ? String(p[priceKey] ?? 0) : l.unit_price } : l)));
  }

  function onPickProduct(i, p) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, product_id: String(p.id), unit_price: String(p[priceKey] ?? 0) } : l)));
  }

  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const p = (products || []).find((x) => String(x.id) === String(l.product_id));
        return (
          <div key={i} className="rounded-lg border border-slate-200 p-3">
            <label htmlFor={`doc-line-${i}`} className="mb-1 block text-xs font-medium text-slate-600">
              Produit ligne {i + 1}{l.product_id ? ` — ${p ? p.name : `#${l.product_id}`}` : ''}
            </label>
            <ProductPicker
              products={products}
              priceKey={priceKey}
              stockHint={stockHint}
              value={l.product_id}
              onPick={(prod) => onPickProduct(i, prod)}
              onSearch={onSearchProducts}
              inputId={`doc-line-${i}`}
            />
            {l.product_id && (
              <button type="button" onClick={() => onProduct(i, '')} className="mt-1 text-xs text-slate-500 hover:underline">
                Changer de produit
              </button>
            )}
            {p && stockHint && <p className="mt-1 text-xs text-slate-500">Stock disponible : {p.quantity}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs">Qté<input inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100" /></label>
              <label className="text-xs">P.U. (Ar)<input inputMode="numeric" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100" /></label>
              <label className="text-xs">Remise<input inputMode="numeric" value={l.discount} onChange={(e) => setLine(i, 'discount', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100" /></label>
              <label className="text-xs">Taxe<input inputMode="numeric" value={l.tax} onChange={(e) => setLine(i, 'tax', e.target.value)} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100" /></label>
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

export function DocForm({ tiers, tierLabel, products, priceKey, stockHint, onSearchProducts, onSubmit, submitting, submitLabel }) {
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
      <Field label={tierLabel} required>
        <Select value={tierId} onChange={(e) => setTierId(e.target.value)}>
          <option value="">— Choisir —</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Lignes *</span>
        <DocLinesEditor products={products} priceKey={priceKey} lines={lines} setLines={setLines} stockHint={stockHint} onSearchProducts={onSearchProducts} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Remise globale (Ar)">
          <TextInput inputMode="numeric" value={docDiscount} onChange={(e) => setDocDiscount(e.target.value)} />
        </Field>
        <Field label="Taxe globale (Ar)">
          <TextInput inputMode="numeric" value={docTax} onChange={(e) => setDocTax(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />
      </Field>
      <div className="rounded-lg bg-slate-50 p-3 text-sm" role="status">
        Sous-total : <strong>{formatMGA(preview.subtotal)}</strong> · Total estimé : <strong>{formatMGA(preview.total)}</strong>
        <span className="block text-xs text-slate-500">Calcul indicatif — le serveur recalcule.</span>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : submitLabel}</PrimaryButton>
    </form>
  );
}
