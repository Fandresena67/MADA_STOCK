import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Loading, ErrorBox } from '../components/common';
import { STATUS_STYLE } from '../components/DocPage';
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

    const load = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        setDoc(await cfg.api.get(id));
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
        <button onClick={() => navigate(cfg.basePath)} className="mb-4 text-sm font-semibold text-primary-600 hover:underline">
          ← Retour
        </button>
        <PageHeader
          title={`${cfg.singular} ${doc.reference}`}
          subtitle={`${cfg.tierLabel} : ${doc.tier_name}`}
          action={
            <div className="flex flex-wrap gap-2">
              {isDraft && can(cfg.perms.confirm) && (
                <button disabled={acting} onClick={onConfirm} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  Confirmer
                </button>
              )}
              {isDraft && can(cfg.perms.update) && (
                <button disabled={acting} onClick={onCancel} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Annuler le brouillon
                </button>
              )}
            </div>
          }
        />
        {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <div className="mb-4 flex items-center gap-3">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[doc.status]}`}>{doc.status}</span>
          <span className="text-sm text-slate-500">Total : <strong className="text-slate-800">{formatMGA(doc.total)}</strong></span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3 text-right">Qté</th>
                <th className="px-4 py-3 text-right">P.U.</th>
                <th className="px-4 py-3 text-right">Remise</th>
                <th className="px-4 py-3 text-right">Taxe</th>
                <th className="px-4 py-3 text-right">Ligne</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3"><div className="font-semibold">{l.product_name}</div><div className="text-xs text-slate-500">{l.product_sku}</div></td>
                  <td className="px-4 py-3 text-right">{l.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatMGA(l.unit_price)}</td>
                  <td className="px-4 py-3 text-right">{formatMGA(l.discount)}</td>
                  <td className="px-4 py-3 text-right">{formatMGA(l.tax)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMGA(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto mt-4 max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="flex justify-between"><span>Sous-total</span><span>{formatMGA(doc.subtotal)}</span></p>
          <p className="flex justify-between"><span>Remise</span><span>{formatMGA(doc.discount)}</span></p>
          <p className="flex justify-between"><span>Taxe</span><span>{formatMGA(doc.tax)}</span></p>
          <p className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total</span><span>{formatMGA(doc.total)}</span></p>
        </div>
        {doc.notes && <p className="mt-4 text-sm text-slate-600">Notes : {doc.notes}</p>}
        {!isDraft && <p className="mt-4 text-xs text-slate-500">Document {doc.status} : lignes et montants figés (historique).</p>}
      </div>
    );
  };
}
