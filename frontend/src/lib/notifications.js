import {
  AlertTriangle, Bell, BellRing, FileText, Info, PackageX,
  ShieldAlert, ShoppingBag, ShoppingCart, TrendingDown,
} from 'lucide-react';

/**
 * Métadonnées d'affichage UNIQUES des notifications (cloche + page).
 * Côté navigation : allowlist stricte, jamais d'URL serveur.
 */
export const TYPE_META = {
  STOCK_LOW: { icon: TrendingDown, label: 'Stock faible', dot: 'bg-amber-500', group: 'stock' },
  STOCK_OUT: { icon: PackageX, label: 'Rupture', dot: 'bg-red-500', group: 'stock' },
  SALE_CREATED: { icon: ShoppingBag, label: 'Vente', dot: 'bg-emerald-500', group: 'sales' },
  SALE_CONFIRMED: { icon: ShoppingBag, label: 'Vente', dot: 'bg-emerald-500', group: 'sales' },
  PURCHASE_CONFIRMED: { icon: ShoppingCart, label: 'Achat', dot: 'bg-blue-500', group: 'purchases' },
  INVOICE_CREATED: { icon: FileText, label: 'Facture', dot: 'bg-violet-500', group: 'invoices' },
  INVOICE_PAID: { icon: FileText, label: 'Facture', dot: 'bg-emerald-500', group: 'invoices' },
  USER_ACTIVITY: { icon: BellRing, label: 'Activité', dot: 'bg-slate-400', group: 'security' },
  SECURITY: { icon: ShieldAlert, label: 'Sécurité', dot: 'bg-orange-500', group: 'security' },
  SYSTEM: { icon: Info, label: 'Système', dot: 'bg-primary-500', group: 'security' },
};

export const FALLBACK_META = { icon: Bell, label: 'Notification', dot: 'bg-slate-400', group: 'security' };

export function metaOf(type) {
  return TYPE_META[type] || FALLBACK_META;
}

/** Destination sûre depuis entity_type/entity_id (allowlist, sinon null). */
export function destinationFor(n) {
  if (!n || n.entityId == null) return null;
  const id = n.entityId;
  if (n.entityType === 'sale') return `/app/sales/${id}`;
  if (n.entityType === 'purchase') return `/app/purchases/${id}`;
  if (n.entityType === 'invoice') return `/app/invoices/${id}`;
  if (n.entityType === 'product') return '/app/inventory';
  return null;
}

/** Date relative courte (fr), repli date courte. */
export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "À l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} j`;
  try {
    return new Date(iso).toLocaleDateString('fr-MG', { dateStyle: 'short' });
  } catch {
    return '';
  }
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}
