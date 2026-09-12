import { useEffect, useState } from 'react';
import { Loader2, Package, Building2 } from 'lucide-react';

export function Field({ label, error, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
        )}
        {required && <span className="sr-only">(obligatoire)</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600" role="alert">{error}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400 ${className || ''}`}
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50"
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50"
    />
  );
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60';

const BUTTON_VARIANTS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  secondary: 'bg-slate-900 text-white hover:bg-slate-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-600 text-white hover:bg-amber-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  dangerOutline: 'border border-red-300 bg-white text-red-600 hover:bg-red-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
};

/** Bouton unifié : variants, tailles, état loading, icône. */
export function Button({ variant = 'primary', size = 'md', loading, icon, children, ...props }) {
  return (
    <button {...props} disabled={loading || props.disabled} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${props.className || ''}`}>
      {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Bouton de formulaire pleine largeur (conserve le comportement historique). */
export function PrimaryButton({ children, ...props }) {
  return (
    <Button {...props} className={`w-full ${props.className || ''}`}>
      {children}
    </Button>
  );
}

export function Card({ children, className }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 ${className || ''}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-slate-800">{children}</h3>
      {action}
    </div>
  );
}

/**
 * Avatar utilisateur : photo si `src` fourni, sinon initiales + teinte déterministe.
 * Image cassée → retour automatique aux initiales. Toujours rond, sans overflow.
 */
export function Avatar({ name, email, src, size }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const px = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const showImg = Boolean(src) && !failed;
  return (
    <span
      className={`flex ${px} shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${tintOf(name || email)}`}
      {...(showImg
        ? { role: 'img', 'aria-label': `Photo de profil de ${name || email || 'l’utilisateur'}` }
        : { 'aria-hidden': 'true' })}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(name, email)
      )}
    </span>
  );
}

const AVATAR_TINTS = [
  'bg-primary-600', 'bg-indigo-600', 'bg-teal-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-700', 'bg-violet-600', 'bg-emerald-700',
];

export function initialsOf(name, email) {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }
  return (email || '?').trim().charAt(0).toUpperCase();
}

function tintOf(seed) {
  let h = 0;
  for (const c of String(seed || '?')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function roleLabel(role) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'company_admin') return 'Company Admin';
  if (role === 'employee') return 'Employé';
  return role || '—';
}

/**
 * Photo produit : image si `src` fourni, sinon icône colis.
 * Image cassée → retour automatique à l'icône. Jamais d'overflow.
 * `className` remplace la taille prédéfinie lorsqu'il est fourni.
 */
export function ProductImage({ src, name, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const px = className || (size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-10 w-10' : 'h-12 w-12');
  const showImg = Boolean(src) && !failed;
  return (
    <span
      className={`flex ${px} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400`}
      {...(showImg ? { role: 'img', 'aria-label': `Photo de ${name || 'produit'}` } : { 'aria-hidden': 'true' })}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Package size={size === 'lg' ? 30 : size === 'sm' ? 18 : 22} aria-hidden="true" />
      )}
    </span>
  );
}

export function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold">MADA STOCK</h1>
        <h2 className="mt-1 text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Logo entreprise : image si `src` fourni, sinon icône bâtiment.
 * Image cassée → retour automatique à l'icône.
 */
export function CompanyLogo({ src, name, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const px = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  const showImg = Boolean(src) && !failed;
  return (
    <span
      className={`flex ${px} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50 text-primary-600`}
      {...(showImg ? { role: 'img', 'aria-label': `Logo de ${name || 'l’entreprise'}` } : { 'aria-hidden': 'true' })}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Building2 size={size === 'lg' ? 28 : size === 'sm' ? 16 : 22} aria-hidden="true" />
      )}
    </span>
  );
}
