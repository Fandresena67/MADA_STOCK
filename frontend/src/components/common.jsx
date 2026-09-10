import { stockStatusStyle } from '../lib/format';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-slate-500">Chargement…</p>;
}

export function Empty({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <button className="mt-2 font-semibold underline" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Page {meta.page}/{meta.totalPages} · {meta.total} élément(s)
      </span>
      <div className="flex gap-2">
        <button
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          ←
        </button>
        <button
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}

export function StockBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockStatusStyle(status)}`}>
      {status}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Rechercher…'}
      aria-label={ariaLabel || placeholder || 'Rechercher'}
      role="searchbox"
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-64"
    />
  );
}
