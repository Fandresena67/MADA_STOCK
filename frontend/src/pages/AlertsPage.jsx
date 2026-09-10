import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader, Loading, ErrorBox } from '../components/common';
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
        <p className="rounded-xl border border-slate-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
          Tout est en ordre : aucun produit en rupture ni en stock faible.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className={`rounded-xl border bg-white p-4 ${p.level === 'RUPTURE' ? 'border-red-300' : 'border-amber-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-slate-500">{p.sku}{p.category_name ? ` · ${p.category_name}` : ''}</p>
                </div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.level === 'RUPTURE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.level}
                </span>
              </div>
              <p className="mt-2 text-sm">Quantité : <strong>{p.quantity}</strong> · Seuil : <strong>{p.min_stock}</strong></p>
              <div className="mt-3 flex gap-3 text-sm">
                <Link to="/app/products" className="font-semibold text-primary-600 hover:underline">Produits</Link>
                <Link to="/app/inventory" className="font-semibold text-primary-600 hover:underline">Inventaire</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
