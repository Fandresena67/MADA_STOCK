import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { verifyInvoice } from '../api/catalog';
import { formatMGA } from '../lib/format';

const STATUS_LABEL = { draft: 'BROUILLON', issued: 'ÉMISE', paid: 'PAYÉE', cancelled: 'ANNULÉE' };

/**
 * Vérification publique d'authenticité (QR code facture).
 * Sans authentification : seules les données strictement nécessaires sont affichées
 * (jamais d'adresse/téléphone/email client, jamais de lignes détaillées).
 */
export default function VerifyInvoicePage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    verifyInvoice(token)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch(() => setState({ loading: false, error: 'Facture introuvable ou invalide.', data: null }));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-bold tracking-wide text-slate-400">MADA STOCK — Vérification</p>
        {state.loading ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 size={18} aria-hidden="true" className="animate-spin" />
            Vérification en cours…
          </p>
        ) : state.error ? (
          <>
            <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
              <ShieldX size={22} />
            </span>
            <h1 className="mt-3 text-lg font-bold text-slate-800">Facture introuvable ou invalide.</h1>
            <p className="mt-1 text-sm text-slate-500">Ce QR Code ne correspond à aucune facture connue.</p>
          </>
        ) : (
          <>
            <span
              className={`mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full ${state.data.status === 'cancelled' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
              aria-hidden="true"
            >
              {state.data.status === 'cancelled' ? <ShieldX size={22} /> : <ShieldCheck size={22} />}
            </span>
            <h1 className="mt-3 text-lg font-bold text-slate-800">
              {state.data.status === 'cancelled' ? 'Facture annulée' : '✓ Facture vérifiée'}
            </h1>
            <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Numéro</dt><dd className="font-semibold">{state.data.invoiceNumber}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Entreprise</dt><dd className="text-right font-semibold">{state.data.companyName}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Date</dt><dd className="font-semibold">{state.data.date ? new Date(state.data.date).toLocaleDateString('fr-MG') : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Montant</dt><dd className="font-semibold tabular-nums">{formatMGA(state.data.total)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Statut</dt><dd className="font-semibold">{STATUS_LABEL[state.data.status] || state.data.status}</dd></div>
            </dl>
          </>
        )}
        <Link to="/login" className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500">
          Ouvrir MADA STOCK
        </Link>
      </div>
    </div>
  );
}
