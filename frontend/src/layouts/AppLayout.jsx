import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { getAccessToken, setAccessToken } from '../api/client';
import { logout as apiLogout, refresh as apiRefresh, me } from '../api/auth';
import { OnlineStatus, UpdateBanner, useServiceWorker } from '../components/Pwa';

const LINKS = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app', label: 'Accueil', end: true },
  { to: '/app/products', label: 'Produits' },
  { to: '/app/categories', label: 'Catégories' },
  { to: '/app/inventory', label: 'Inventaire' },
  { to: '/app/movements', label: 'Mouvements' },
  { to: '/app/suppliers', label: 'Fournisseurs' },
  { to: '/app/customers', label: 'Clients' },
  { to: '/app/purchases', label: 'Achats' },
  { to: '/app/sales', label: 'Ventes' },
  { to: '/app/invoices', label: 'Factures' },
  { to: '/app/reports', label: 'Rapports' },
  { to: '/app/alerts', label: 'Alertes' },
  { to: '/app/settings', label: 'Paramètres' },
];

export function ProtectedRoute() {
  const [state, setState] = useState(() => (getAccessToken() ? 'ok' : 'checking'));

  useEffect(() => {
    if (state !== 'checking') return;
    apiRefresh()
      .then((r) => {
        setAccessToken(r.accessToken);
        setState('ok');
      })
      .catch(() => setState('ko'));
  }, [state]);

  if (state === 'checking') {
    return <p className="p-8 text-sm text-slate-500">Vérification de la session…</p>;
  }
  if (state === 'ko') return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AppLayout() {
  const [user, setUser] = useState(null);
  const { updateAvailable, applyUpdate } = useServiceWorker();

  useEffect(() => {
    me().then(setUser).catch(() => {});
  }, []);

  async function onLogout() {
    try {
      await apiLogout();
    } catch {
      // Session déjà invalide : on nettoie quand même côté client.
    } finally {
      setAccessToken(null);
      window.location.href = '/login';
    }
  }

  return (
    <div className="min-h-screen">
      <OnlineStatus />
      {updateAvailable && <UpdateBanner onUpdate={applyUpdate} />}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-bold">MADA STOCK</span>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-slate-500 sm:inline">{user.company?.name}</span>}
            {user?.role === 'super_admin' && (
              <a href="/superadmin/dashboard" className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700">
                Super Admin
              </a>
            )}
            <button className="text-sm text-slate-600 hover:text-slate-900" onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
