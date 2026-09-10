import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices, createInvoice, listSales, listCustomers, listProducts } from '../api/catalog';
import { PageHeader, Loading, Empty, ErrorBox, Modal, Pagination, SearchInput } from '../components/common';
import { STATUS_STYLE } from '../components/DocPage';
import { DocLinesEditor } from '../components/DocForm';
import { Field, TextInput, PrimaryButton } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';

function InvoiceForm({ confirmedSales, customers, products, onSubmit, submitting }) {
  const [mode, setMode] = useState('sale');
  const [saleId, setSaleId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: '1', unit_price: '0', discount: '0', tax: '0' }]);
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function handle(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'sale') {
        if (!saleId) {
          setError('Vente requise');
          return;
        }
        await onSubmit({ sale_id: Number(saleId), due_at: dueAt || undefined, notes: notes.trim() });
      } else {
        if (!customerId) {
          setError('Client requis');
          return;
        }
        const items = [];
        for (const l of lines) {
          const q = Number(l.quantity), u = Number(l.unit_price), d = Number(l.discount) || 0, t = Number(l.tax) || 0;
          if (!Number.isInteger(q) || q <= 0 || !Number.isInteger(u) || u < 0 || d < 0 || t < 0) {
            setError('Lignes invalides (quantité > 0, montants ≥ 0)');
            return;
          }
          const p = products.find((x) => String(x.id) === String(l.product_id));
          items.push({ product_id: l.product_id ? Number(l.product_id) : null, product_name: p ? p.name : `Ligne ${items.length + 1}`, quantity: q, unit_price: u, discount: d, tax: t });
        }
        if (!items.every((it) => it.product_id || it.product_name)) {
          setError('Chaque ligne : produit ou désignation');
          return;
        }
        await onSubmit({ customer_id: Number(customerId), items, due_at: dueAt || undefined, notes: notes.trim() });
      }
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setMode('sale')} className={`rounded-lg px-3 py-1.5 font-medium ${mode === 'sale' ? 'bg-primary-600 text-white' : 'border border-slate-300'}`}>
          Depuis une vente
        </button>
        <button type="button" onClick={() => setMode('free')} className={`rounded-lg px-3 py-1.5 font-medium ${mode === 'free' ? 'bg-primary-600 text-white' : 'border border-slate-300'}`}>
          Saisie libre
        </button>
      </div>
      {mode === 'sale' ? (
        <Field label="Vente confirmée *">
          <select value={saleId} onChange={(e) => setSaleId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">— Choisir —</option>
            {confirmedSales.map((s) => (
              <option key={s.id} value={s.id}>{s.reference} — {s.tier_name} — {formatMGA(s.total)}</option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Client *">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">— Choisir —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Lignes *</span>
            <DocLinesEditor products={products} priceKey="sale_price" lines={lines} setLines={setLines} stockHint={false} />
          </div>
        </>
      )}
      <Field label="Échéance">
        <TextInput type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Création…' : 'Créer la facture'}</PrimaryButton>
    </form>
  );
}

export default function InvoicesPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmedSales, setConfirmedSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      const res = await listInvoices(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    listSales({ page: 1, limit: 100, status: 'confirmed' }).then((r) => setConfirmedSales(r.data)).catch(() => {});
    listCustomers({ page: 1, limit: 100 }).then((r) => setCustomers(r.data.filter((c) => c.is_active))).catch(() => {});
    listProducts({ page: 1, limit: 100 }).then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      await createInvoice(payload);
      setModal(false);
      setNotice('Facture créée.');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle="Facturation liée aux ventes confirmées"
        action={
          can('invoices.create') && (
            <button onClick={() => setModal(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              + Nouvelle facture
            </button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={filters.search} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, search: v })); }} placeholder="Numéro, client…" />
        <select value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          <option value="draft">Brouillon</option>
          <option value="issued">Émise</option>
          <option value="paid">Payée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty message="Aucune facture." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Détail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold">{f.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-600">{f.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[f.status]}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMGA(f.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/app/invoices/${f.id}`} className="font-semibold text-primary-600 hover:underline">Ouvrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {modal && (
        <Modal title="Nouvelle facture" onClose={() => setModal(false)}>
          <InvoiceForm confirmedSales={confirmedSales} customers={customers} products={products} onSubmit={handleSubmit} submitting={submitting} />
        </Modal>
      )}
    </div>
  );
}
