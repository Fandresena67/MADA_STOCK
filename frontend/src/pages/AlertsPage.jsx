import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader, Loading, ErrorBox, StockBadge, EmptyState } from '../components/common';
import { Card } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { alertsList } from '../api/stats';

export default function AlertsPage() {
  const { can } = usePermissions();
  const query = useQuery({ queryKey: ['alerts', 'all'], queryFn: () => alertsList({ limit: 200 }) });

  if (!can('alerts.view')) {
    return <ErrorBox message="Accès refusé : permission alerts.view requise." />;
  }

  const items = query.data || [];

  return (
    <div>
      <PageHeader title="Alertes" subtitle="Ruptures et stocks faibles — données temps réel" />
      {query.isPending ? <Loading /> : query.isError ? <ErrorBox message="Impossible de charger les alertes." onRetry={() => query.refetch()} /> : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} aria-hidden="true" className="text-emerald-500" />}
          title="Tout est en ordre"
          message="Aucun produit en rupture ni en stock faible."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className={p.level === 'RUPTURE' ? 'border-red-300' : 'border-amber-300'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <p className="truncate text-xs text-slate-500">{p.sku}{p.category_name ? ` · ${p.category_name}` : ''}</p>
                </div>
                <StockBadge status={p.level} />
              </div>
              <p className="mt-2 text-sm">Quantité : <strong className="tabular-nums">{p.quantity}</strong> · Seuil : <strong className="tabular-nums">{p.min_stock}</strong></p>
              <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-sm">
                <Link to="/app/products" className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Produits</Link>
                <Link to="/app/inventory" className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">Inventaire</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
