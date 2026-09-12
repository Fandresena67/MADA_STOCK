import { useEffect, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, X, Inbox } from 'lucide-react';
import { stockStatusStyle } from '../lib/format';

export function PageHeader({ title, subtitle, action, actionClassName }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 title={typeof title === 'string' ? title : undefined} className="break-words text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className={`flex shrink-0 flex-wrap gap-2 ${actionClassName || ''}`}>{action}</div>}
    </div>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-slate-500" role="status">Chargement…</p>;
}

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200 ${className || 'h-24'}`} />;
}

export function SkeletonGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

export function Empty({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

/** État vide premium : icône + titre + message + action éventuelle (si permise). */
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
        {icon || <Inbox size={22} />}
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-800">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="mt-2 rounded font-semibold underline outline-none focus-visible:ring-2 focus-visible:ring-red-500" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose, labelledBy }) {
  const titleId = useId();
  const closeRef = useRef(null);
  // Toujours le dernier onClose sans re-souscrire (évite de rejouer l'effet
  // quand le parent re-render avec une closure inline — sinon le focus
  // serait volé à chaque frappe dans un formulaire du modal).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Focus initial une seule fois à l'ouverture (accessibilité clavier conservée).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={labelledBy || titleId} className="text-lg font-semibold">{title}</h2>
          <button ref={closeRef} className="rounded-lg p-1 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary-500" onClick={onClose} aria-label="Fermer">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage, label }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label={label || 'Pagination'} className="mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate text-slate-500">
        Page {meta.page}/{meta.totalPages} · {meta.total} élément(s)
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Page précédente"
          className="rounded-lg border border-slate-300 bg-white p-1.5 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Page suivante"
          className="rounded-lg border border-slate-300 bg-white p-1.5 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export function StockBadge({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockStatusStyle(status)}`}>
      {status}
    </span>
  );
}

const DOC_STATUS_STYLE = {
  draft: 'bg-slate-200 text-slate-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

const DOC_STATUS_LABEL = {
  draft: 'BROUILLON', confirmed: 'CONFIRMÉ', cancelled: 'ANNULÉ',
  issued: 'ÉMISE', paid: 'PAYÉE',
};

/** Badge unifié documents (achats/ventes/factures) et mouvements. */
export function StatusBadge({ status, labels }) {
  const style = DOC_STATUS_STYLE[status] || 'bg-slate-200 text-slate-700';
  const text = (labels && labels[status]) || DOC_STATUS_LABEL[status] || status;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {text}
    </span>
  );
}

const MOVEMENT_STYLE = {
  initial: 'bg-slate-200 text-slate-700',
  in: 'bg-emerald-100 text-emerald-700',
  out: 'bg-red-100 text-red-700',
  adjustment: 'bg-amber-100 text-amber-700',
};

const MOVEMENT_LABEL = { initial: 'Initial', in: 'Entrée', out: 'Sortie', adjustment: 'Ajustement' };

export function MovementBadge({ type }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${MOVEMENT_STYLE[type] || 'bg-slate-200 text-slate-700'}`}>
      {MOVEMENT_LABEL[type] || type}
    </span>
  );
}

/** Tableau responsive unifié (conteneur scroll + styles cohérents). */
export function Table({ minWidth, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <table className={`w-full text-sm ${minWidth || 'min-w-[640px]'}`}>{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ right, children }) {
  return <th scope="col" className={`px-4 py-3 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>;
}

export function Td({ right, muted, children }) {
  return <td className={`px-4 py-3 ${right ? 'text-right' : ''} ${muted ? 'text-slate-500' : ''}`}>{children}</td>;
}

export function SearchInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Rechercher…'}
        aria-label={ariaLabel || placeholder || 'Rechercher'}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
    </div>
  );
}

/** Badge unifié pour les éléments désactivés (catégories, tiers). */
export function InactiveBadge({ label }) {
  return (
    <span className="inline-block shrink-0 whitespace-nowrap rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      {label || 'Désactivé'}
    </span>
  );
}

/** Groupe segmenté accessible (onglets/filtres) : état pressé exposé aux lecteurs d'écran. */
export function SegmentedGroup({ label, children }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto pb-1">
      {children}
    </div>
  );
}

export function FilterButton({ active, onClick, children, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active ? 'bg-primary-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
