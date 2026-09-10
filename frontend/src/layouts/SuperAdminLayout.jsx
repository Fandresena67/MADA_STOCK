import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { setAccessToken } from '../api/client';
import { logout as apiLogout, me } from '../api/auth';
import { OnlineStatus, UpdateBanner, useServiceWorker } from '../components/Pwa';

const LINKS = [
  { to: '/superadmin/dashboard', label: 'Vue globale', end: true },
  { to: '/superadmin/companies', label: 'Entreprises' },
  { to: '/superadmin/users', label: 'Utilisateurs' },
  { to: '/superadmin/audit', label: 'Audit global' },
];

export function SuperAdminRoute() {
  const [state, setState] = useState('checking');
  const [role, setRole] = useState(null);

  useEffect(() => {
    me()
      .then((u) => {
        if (u.role === 'super_admin') {
          setRole(u.role);
          setState('ok');
        } else {
          setState('ko');
        }
      })
      .catch(() => setState('ko'));
  }, []);

  if (state === 'checking') {
    return <p className="p-8 text-sm text-slate-500">Vérification des privilèges…</p>;
  }
  if (state === 'ko') return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function SuperAdminLayout() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  async function onLogout() {
    try {
      await apiLogout();
    } catch {
      // Session déjà invalide.
    } finally {
      setAccessToken(null);
      window.location.href = '/login';
    }
  }

  return (
    <div className="min-h-screen">
      <OnlineStatus />
      {updateAvailable && <UpdateBanner onUpdate={applyUpdate} />}
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-bold">MADA STOCK · Super Admin</span>
          <div className="flex items-center gap-3">
            <a href="/app" className="text-sm text-slate-300 hover:text-white">
              Espace entreprise
            </a>
            <button className="text-sm text-slate-300 hover:text-white" onClick={onLogout}>
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
                  isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800'
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
