import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Check, XCircle, ArrowLeft, FileText } from 'lucide-react';
import { PageHeader, Loading, ErrorBox, Table, Thead, Th, Td } from '../components/common';
import { StatusBadge } from '../components/common';
import { Button } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { useInvalidateStats } from '../hooks/useInvalidateStats';
import { formatMGA } from '../lib/format';

export function makeDocDetail(cfg) {
  return function DocDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = usePermissions();
    const invalidateStats = useInvalidateStats();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [acting, setActing] = useState(false);
    const [notice, setNotice] = useState('');
    const [invoice, setInvoice] = useState(null);

    const load = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        const d = await cfg.api.get(id);
        setDoc(d);
        // Facture associée (ventes confirmées uniquement, via cfg opt-in).
        if (cfg.linkedInvoice && d.status === 'confirmed') {
          cfg.linkedInvoice
            .list(d.id)
            .then((rows) => setInvoice(rows[0] || null))
            .catch(() => {});
        } else {
          setInvoice(null);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    }, [id]);

    useEffect(() => {
      load();
    }, [load]);

    async function onConfirm() {
      if (!window.confirm(cfg.confirmText)) return;
      setActing(true);
      try {
        const updated = await cfg.api.confirm(id);
        setDoc(updated);
        invalidateStats();
        setNotice(updated.alreadyConfirmed ? 'Déjà confirmé (aucun double mouvement).' : 'Confirmé : stock mis à jour.');
      } catch (err) {
        alert(err.response?.data?.error || 'Confirmation impossible');
      } finally {
        setActing(false);
      }
    }

    async function onCancel() {
      if (!window.confirm('Annuler ce brouillon ?')) return;
      setActing(true);
      try {
        setDoc(await cfg.api.update(id, { status: 'cancelled' }));
        setNotice('Brouillon annulé.');
      } catch (err) {
        alert(err.response?.data?.error || 'Annulation impossible');
      } finally {
        setActing(false);
      }
    }

    if (loading) return <Loading />;
    if (error) return <ErrorBox message={error} onRetry={load} />;
    if (!doc) return null;
    const isDraft = doc.status === 'draft';

    return (
      <div>
        <button onClick={() => navigate(cfg.basePath)} className="mb-4 inline-flex items-center gap-1 rounded text-sm font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
          <ArrowLeft size={16} aria-hidden="true" />Retour
        </button>
        <PageHeader
          title={`${cfg.singular} ${doc.reference}`}
          subtitle={`${cfg.tierLabel} : ${doc.tier_name}`}
          action={
            <div className="flex flex-wrap gap-2">
              {isDraft && can(cfg.perms.confirm) && (
                <Button variant="success" loading={acting} onClick={onConfirm} icon={<Check size={16} aria-hidden="true" />}>
                  Confirmer
                </Button>
              )}
              {isDraft && can(cfg.perms.update) && (
                <Button variant="dangerOutline" loading={acting} onClick={onCancel} icon={<XCircle size={16} aria-hidden="true" />}>
                  Annuler le brouillon
                </Button>
              )}
            </div>
          }
        />
        {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <div className="mb-4 flex items-center gap-3">
          <StatusBadge status={doc.status} />
          <span className="text-sm text-slate-500">Total : <strong className="text-slate-800">{formatMGA(doc.total)}</strong></span>
        </div>
        <Table minWidth="min-w-[560px]">
          <Thead>
            <Th>Produit</Th>
            <Th right>Qté</Th>
            <Th right>P.U.</Th>
            <Th right>Remise</Th>
            <Th right>Taxe</Th>
            <Th right>Ligne</Th>
          </Thead>
          <tbody>
            {doc.items.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <Td><div className="font-semibold">{l.product_name}</div><div className="text-xs text-slate-500">{l.product_sku}</div></Td>
                <Td right><span className="tabular-nums">{l.quantity}</span></Td>
                <Td right muted><span className="tabular-nums">{formatMGA(l.unit_price)}</span></Td>
                <Td right muted><span className="tabular-nums">{formatMGA(l.discount)}</span></Td>
                <Td right muted><span className="tabular-nums">{formatMGA(l.tax)}</span></Td>
                <Td right><span className="font-semibold tabular-nums">{formatMGA(l.line_total)}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="ml-auto mt-4 max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="flex justify-between"><span>Sous-total</span><span>{formatMGA(doc.subtotal)}</span></p>
          <p className="flex justify-between"><span>Remise</span><span>{formatMGA(doc.discount)}</span></p>
          <p className="flex justify-between"><span>Taxe</span><span>{formatMGA(doc.tax)}</span></p>
          <p className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total</span><span>{formatMGA(doc.total)}</span></p>
        </div>
        {doc.notes && <p className="mt-4 text-sm text-slate-600">Notes : {doc.notes}</p>}
        {!isDraft && <p className="mt-4 text-xs text-slate-500">Document {doc.status} : lignes et montants figés (historique).</p>}
        {cfg.linkedInvoice && !isDraft && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <FileText size={17} aria-hidden="true" className="shrink-0 text-slate-400" />
            {invoice ? (
              <>
                <span className="min-w-0">
                  Facture associée : <strong>{invoice.invoice_number}</strong>
                  <span className="ml-2 text-xs text-slate-500">{invoice.status}</span>
                </span>
                <Link to={`${cfg.linkedInvoice.basePath}/${invoice.id}`} className="ml-auto shrink-0 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                  Voir la facture
                </Link>
              </>
            ) : (
              <>
                <span className="text-slate-600">Aucune facture pour cette vente.</span>
                <Link to={cfg.linkedInvoice.basePath} className="ml-auto shrink-0 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                  Créer une facture
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    );
  };
}
