import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { listInvoices, createInvoice, listSales, listCustomers, listProducts } from '../api/catalog';
import { PageHeader, Loading, ErrorBox, Modal, Pagination, SearchInput, EmptyState, Table, Thead, Th, Td } from '../components/common';
import { StatusBadge } from '../components/common';
import { Button } from '../components/ui';
import { DocLinesEditor } from '../components/DocForm';
import { Field, TextInput, PrimaryButton, Select, Textarea } from '../components/ui';
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
      <div className="flex gap-2 text-sm" role="group" aria-label="Mode de création de la facture">
        <button type="button" onClick={() => setMode('sale')} aria-pressed={mode === 'sale'} className={`rounded-lg px-3 py-1.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${mode === 'sale' ? 'bg-primary-600 text-white' : 'border border-slate-300'}`}>
          Depuis une vente
        </button>
        <button type="button" onClick={() => setMode('free')} aria-pressed={mode === 'free'} className={`rounded-lg px-3 py-1.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${mode === 'free' ? 'bg-primary-600 text-white' : 'border border-slate-300'}`}>
          Saisie libre
        </button>
      </div>
      {mode === 'sale' ? (
        <Field label="Vente confirmée *">
          <Select value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">— Choisir —</option>
            {confirmedSales.map((s) => (
              <option key={s.id} value={s.id}>{s.reference} — {s.tier_name} — {formatMGA(s.total)}</option>
            ))}
          </Select>
        </Field>
      ) : (
        <>
          <Field label="Client *">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Choisir —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
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
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />
      </Field>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Création…' : 'Créer la facture'}</PrimaryButton>
    </form>
  );
}

export default function InvoicesPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', customer_id: '', date_from: '', date_to: '', sort: '', order: 'desc' });
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
      if (filters.customer_id) params.customer_id = filters.customer_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.sort) {
        params.sort = filters.sort;
        params.order = filters.order;
      }
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
            <Button onClick={() => setModal(true)} icon={<Plus size={16} aria-hidden="true" />}>
              Nouvelle facture
            </Button>
          )
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:items-center">
        <SearchInput value={filters.search} onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, search: v })); }} placeholder="Numéro, client…" />
        <Select value={filters.status} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }} aria-label="Filtrer par statut">
          <option value="">Tous statuts</option>
          <option value="draft">Brouillon</option>
          <option value="issued">Émise</option>
          <option value="paid">Payée</option>
          <option value="cancelled">Annulée</option>
        </Select>
        <Select value={filters.customer_id} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, customer_id: e.target.value })); }} aria-label="Filtrer par client">
          <option value="">Tous clients</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select
          value={filters.sort ? `${filters.sort}:${filters.order}` : ''}
          onChange={(e) => {
            const [sort, order] = e.target.value ? e.target.value.split(':') : ['', 'desc'];
            setPage(1);
            setFilters((f) => ({ ...f, sort, order }));
          }}
          aria-label="Trier les factures"
        >
          <option value="">Tri : récent</option>
          <option value="created_at:desc">Date (récent)</option>
          <option value="created_at:asc">Date (ancien)</option>
          <option value="total:desc">Montant (élevé)</option>
          <option value="total:asc">Montant (faible)</option>
          <option value="invoice_number:asc">Numéro (A→Z)</option>
          <option value="customer:asc">Client (A→Z)</option>
          <option value="status:asc">Statut</option>
        </Select>
        <input type="date" value={filters.date_from} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, date_from: e.target.value })); }} aria-label="Date début" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
        <input type="date" value={filters.date_to} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, date_to: e.target.value })); }} aria-label="Date fin" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} aria-hidden="true" />}
          title="Aucune facture"
          message="Créez une facture depuis une vente confirmée ou en saisie libre."
          action={can('invoices.create') && (
            <Button onClick={() => setModal(true)} icon={<Plus size={16} aria-hidden="true" />}>
              Nouvelle facture
            </Button>
          )}
        />
      ) : (
          <Table>
            <Thead>
              <Th>Numéro</Th>
              <Th>Client</Th>
              <Th>Date</Th>
              <Th>Statut</Th>
              <Th right>Total</Th>
              <Th right>Détail</Th>
            </Thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <Td><span className="font-semibold">{f.invoice_number}</span></Td>
                  <Td muted>{f.customer_name}</Td>
                  <Td muted><span className="whitespace-nowrap">{f.created_at ? new Date(f.created_at).toLocaleDateString('fr-MG') : '—'}</span></Td>
                  <Td>
                    <StatusBadge status={f.status} />
                  </Td>
                <Td right><span className="font-semibold tabular-nums">{formatMGA(f.total)}</span></Td>
                <Td right>
                  <Link to={`/app/invoices/${f.id}`} className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Ouvrir</Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
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
