import { useQuery } from '@tanstack/react-query';
import { PageHeader, ErrorBox } from '../components/common';
import { formatMGA } from '../lib/format';
import { superDashboard } from '../api/admin';

function Kpi({ label, value, money }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{money ? formatMGA(value) : value}</p>
    </div>
  );
}

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-xl bg-slate-200" />;
}

export default function SuperDashboard() {
  const query = useQuery({ queryKey: ['superadmin', 'dashboard'], queryFn: superDashboard });

  return (
    <div>
      <PageHeader title="Vue globale" subtitle="Plateforme MADA STOCK — toutes entreprises (données réelles)" />
      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>
      ) : query.isError ? (
        <ErrorBox message="Impossible de charger les statistiques globales." onRetry={() => query.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Entreprises" value={query.data.companies.total} />
          <Kpi label="Entreprises actives" value={query.data.companies.active} />
          <Kpi label="Entreprises désactivées" value={query.data.companies.disabled} />
          <Kpi label="Utilisateurs" value={query.data.users.total} />
          <Kpi label="Utilisateurs actifs" value={query.data.users.active} />
          <Kpi label="Produits (toutes)" value={query.data.products_total} />
          <Kpi label="Ventes confirmées" value={query.data.sales_count} />
          <Kpi label="CA global" value={query.data.revenue} money />
        </div>
      )}
    </div>
  );
}
