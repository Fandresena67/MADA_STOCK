import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import { me } from '../api/auth';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader, Loading } from '../components/common';
import { Button, Card, CardTitle } from '../components/ui';

export default function DashboardPlaceholder() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();

  useEffect(() => {
    me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Accueil"
        subtitle="Vue d'ensemble de votre espace entreprise"
        action={
          can('dashboard.view') && (
            <Link to="/app/dashboard">
              <Button variant="secondary" icon={<LayoutDashboard size={16} aria-hidden="true" />}>
                Tableau de bord
              </Button>
            </Link>
          )
        }
      />
      {loading ? (
        <Loading />
      ) : user ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Mon profil</CardTitle>
            <p className="text-sm">
              <strong>{user.name}</strong> — {user.email} ({user.role})
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Entreprise : {user.company?.name} · Monnaie : {user.company?.currency}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Permissions ({user.permissions?.length ?? 0}) :{' '}
              <span className="text-slate-700">{(user.permissions || []).slice(0, 8).join(', ')}{user.permissions?.length > 8 ? '…' : ''}</span>
            </p>
          </Card>
          <Card>
            <CardTitle>Accès rapides</CardTitle>
            <div className="flex flex-col gap-2 text-sm">
              {can('dashboard.view') && (
                <Link to="/app/dashboard" className="inline-flex items-center gap-1 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                  Ouvrir le tableau de bord <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
              {can('products.view') && (
                <Link to="/app/products" className="inline-flex items-center gap-1 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                  Gérer les produits <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
              {can('stock.view') && (
                <Link to="/app/movements" className="inline-flex items-center gap-1 rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
                  Voir les mouvements de stock <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
