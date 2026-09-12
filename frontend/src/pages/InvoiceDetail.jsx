import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, BadgeCheck, XCircle, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { verifyInvoiceUrl } from '../api/catalog';
import { getInvoice, setInvoiceStatus } from '../api/catalog';
import { getSettings } from '../api/admin';
import { companyLogoSrc } from '../api/admin';
import { PageHeader, Loading, ErrorBox, Table, Thead, Th, Td } from '../components/common';
import { StatusBadge } from '../components/common';
import { Button, CompanyLogo } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { formatMGA, normalizeUrl } from '../lib/format';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [inv, setInv] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invoice, settings] = await Promise.all([
        getInvoice(id),
        getSettings().catch(() => null),
      ]);
      setInv(invoice);
      setCompany(settings);
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

  // Identité historisée : snapshot au moment de l'émission, repli live pour les anciennes.
  const co = inv.company_snapshot || company || {};
  const coTitle = co.trade_name?.trim() || co.name || '—';
  const coLegal = co.trade_name?.trim() && co.name && co.trade_name.trim() !== co.name.trim() ? co.name : null;
  const coWebsite = normalizeUrl(co.website);

  return (
    <div>
      <button onClick={() => navigate('/app/invoices')} className="mb-4 inline-flex items-center gap-1 rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 print:hidden">
        <ArrowLeft size={16} aria-hidden="true" />Retour
      </button>
      <PageHeader
        title={`Facture ${inv.invoice_number}`}
        subtitle={`Client : ${inv.customer_name}`}
        actionClassName="print:hidden"
        action={
          <div className="flex flex-wrap gap-2">
            {can('invoices.update') && inv.status === 'draft' && (
              <Button variant="secondary" loading={acting} onClick={() => change('issued', 'Émettre')} icon={<Send size={16} aria-hidden="true" />}>
                Émettre
              </Button>
            )}
            {can('invoices.update') && inv.status === 'issued' && (
              <Button variant="success" loading={acting} onClick={() => change('paid', 'Marquer payée')} icon={<BadgeCheck size={16} aria-hidden="true" />}>
                Marquer payée
              </Button>
            )}
            {can('invoices.update') && (inv.status === 'draft' || inv.status === 'issued') && (
              <Button variant="dangerOutline" loading={acting} onClick={() => change('cancelled', 'Annuler')} icon={<XCircle size={16} aria-hidden="true" />}>
                Annuler
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} icon={<Printer size={16} aria-hidden="true" />}>
              Imprimer / PDF
            </Button>
          </div>
        }
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 print:hidden" role="status">{notice}</p>}
      <div className="mb-4 break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 text-sm print:border-slate-400 print:shadow-none sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between print:border-slate-400">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyLogo src={companyLogoSrc(co.logo_url)} name={coTitle} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{coTitle}</p>
              {coLegal && <p className="truncate text-xs text-slate-500">{coLegal}</p>}
              {co.owner_name && <p className="text-slate-600">Titulaire : {co.owner_name}</p>}
              {[co.address, [co.city, co.country].filter(Boolean).join(' · ')].filter(Boolean).map((v) => (
                <p key={v} className="text-slate-600">{v}</p>
              ))}
              {[co.phone, co.email].filter(Boolean).map((v) => (
                <p key={v} className="text-slate-600">{v}</p>
              ))}
              {coWebsite && (
                <p className="truncate text-slate-600">
                  <a href={coWebsite} target="_blank" rel="noopener noreferrer" className="rounded text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                    {co.website.trim()}
                  </a>
                </p>
              )}
              {[co.tax_id && `NIF : ${co.tax_id}`, co.stat_number && `STAT : ${co.stat_number}`, co.rcs_number && `RCS : ${co.rcs_number}`].filter(Boolean).map((v) => (
                <p key={v} className="text-slate-600">{v}</p>
              ))}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-lg font-bold tracking-wide text-slate-900">FACTURE</p>
            <p className="font-semibold text-primary-700">{inv.invoice_number}</p>
            <p className="mt-1 text-slate-600">Date : {inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-MG') : '—'}</p>
            <p className="mt-1"><StatusBadge status={inv.status} /></p>
          </div>
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
            <p className="text-slate-600">Émise le : {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('fr-MG') : '—'}</p>
            <p className="text-slate-600">Échéance : {inv.due_at ? new Date(inv.due_at).toLocaleDateString('fr-MG') : '—'}</p>
          </div>
        </div>
      </div>
      <Table minWidth="min-w-[560px]">
        <Thead>
          <Th>Désignation</Th>
          <Th right>Qté</Th>
          <Th right>P.U.</Th>
          <Th right>Remise</Th>
          <Th right>Montant</Th>
        </Thead>
        <tbody>
          {inv.items.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 last:border-0 print:[break-inside:avoid]">
              <Td><span className="font-semibold">{l.product_name}</span></Td>
              <Td right><span className="tabular-nums">{l.quantity}</span></Td>
              <Td right muted><span className="tabular-nums">{formatMGA(l.unit_price)}</span></Td>
              <Td right muted><span className="tabular-nums">{formatMGA(l.discount)}</span></Td>
              <Td right><span className="font-semibold tabular-nums">{formatMGA(l.line_total)}</span></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="ml-auto mt-4 max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm print:border-slate-400 print:shadow-none">
        <p className="flex justify-between"><span>Sous-total</span><span>{formatMGA(inv.subtotal)}</span></p>
        <p className="flex justify-between"><span>Remise</span><span>{formatMGA(inv.discount)}</span></p>
        <p className="flex justify-between"><span>Taxe</span><span>{formatMGA(inv.tax)}</span></p>
        <p className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total</span><span>{formatMGA(inv.total)}</span></p>
      </div>
      {inv.notes && <p className="mt-4 text-sm text-slate-600">Notes : {inv.notes}</p>}
      {co.payment_info && (
        <p className="mt-4 text-sm text-slate-600">Paiement : {co.payment_info}</p>
      )}
      {co.payment_terms && (
        <p className="mt-1 text-sm text-slate-600">Conditions : {co.payment_terms}</p>
      )}
      <div className="mt-6 flex flex-col items-center gap-4 border-t border-slate-200 pt-4 text-center print:border-slate-400 sm:flex-row sm:justify-between sm:text-left">
        <div className="min-w-0 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">{coTitle}</p>
          {[co.address, co.phone, co.email].filter(Boolean).map((v) => (
            <p key={v} className="truncate">{v}</p>
          ))}
          <p className="mt-2">Merci pour votre confiance.</p>
        </div>
        {inv.verify_token && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <QRCodeSVG
              value={verifyInvoiceUrl(inv.verify_token)}
              size={120}
              role="img"
              aria-label={`QR de vérification de la facture ${inv.invoice_number}`}
            />
            <p className="max-w-[160px] text-xs text-slate-500">Scanner pour vérifier cette facture</p>
          </div>
        )}
      </div>
    </div>
  );
}
