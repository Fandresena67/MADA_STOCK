import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getInvoice, setInvoiceStatus } from '../api/catalog';
import { PageHeader, Loading, ErrorBox } from '../components/common';
import { STATUS_STYLE } from '../components/DocPage';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA } from '../lib/format';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInv(await getInvoice(id));
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function change(status, label) {
    if (!window.confirm(`${label} cette facture ?`)) return;
    setActing(true);
    try {
      setInv(await setInvoiceStatus(id, status));
      setNotice('Statut mis à jour.');
    } catch (err) {
      alert(err.response?.data?.error || 'Opération impossible');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!inv) return null;

  return (
    <div>
      <style>{`@media print { header, nav, button { display: none !important; } main { max-width: 100% !important; padding: 0 !important; } body { background: white; } }`}</style>
      <button onClick={() => navigate('/app/invoices')} className="mb-4 text-sm font-semibold text-primary-600 hover:underline">
        ← Retour
      </button>
      <PageHeader
        title={`Facture ${inv.invoice_number}`}
        subtitle={`Client : ${inv.customer_name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {can('invoices.update') && inv.status === 'draft' && (
              <button disabled={acting} onClick={() => change('issued', 'Émettre')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                Émettre
              </button>
            )}
            {can('invoices.update') && inv.status === 'issued' && (
              <button disabled={acting} onClick={() => change('paid', 'Marquer payée')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                Marquer payée
              </button>
            )}
            {can('invoices.update') && (inv.status === 'draft' || inv.status === 'issued') && (
              <button disabled={acting} onClick={() => change('cancelled', 'Annuler')} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                Annuler
              </button>
            )}
            <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Imprimer
            </button>
          </div>
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
          <span className="text-slate-500">Émise le : {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('fr-MG') : '—'}</span>
          <span className="text-slate-500">Échéance : {inv.due_at ? new Date(inv.due_at).toLocaleDateString('fr-MG') : '—'}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="font-semibold">Facturé à</p>
            <p>{inv.customer_name}</p>
            {[inv.customer_email, inv.customer_phone, inv.customer_address].filter(Boolean).map((v) => (
              <p key={v} className="text-slate-600">{v}</p>
            ))}
          </div>
          <div>
            <p className="font-semibold">Références</p>
            <p className="text-slate-600">Vente liée : {inv.sale_id || '—'}</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Désignation</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3 text-right">P.U.</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold">{l.product_name}</td>
                <td className="px-4 py-3 text-right">{l.quantity}</td>
                <td className="px-4 py-3 text-right">{formatMGA(l.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatMGA(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ml-auto mt-4 max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="flex justify-between"><span>Sous-total</span><span>{formatMGA(inv.subtotal)}</span></p>
        <p className="flex justify-between"><span>Remise</span><span>{formatMGA(inv.discount)}</span></p>
        <p className="flex justify-between"><span>Taxe</span><span>{formatMGA(inv.tax)}</span></p>
        <p className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total</span><span>{formatMGA(inv.total)}</span></p>
      </div>
      {inv.notes && <p className="mt-4 text-sm text-slate-600">Notes : {inv.notes}</p>}
    </div>
  );
}
