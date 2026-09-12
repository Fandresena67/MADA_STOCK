import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { setAccessToken } from '../api/client';
import { logout as apiLogout, me } from '../api/auth';
import { buildSuperAdminNav } from '../app/nav';
import { AppShell } from '../components/AppShell';
import { NotificationBell } from '../components/NotificationBell';

export function SuperAdminRoute() {
  const [state, setState] = useState('checking');

  useEffect(() => {
    me()
      .then((u) => setState(u.role === 'super_admin' ? 'ok' : 'ko'))
      .catch(() => setState('ko'));
  }, []);

  if (state === 'checking') {
    return <p className="p-8 text-sm text-slate-500">Vérification des privilèges…</p>;
  }
  if (state === 'ko') return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function SuperAdminLayout() {
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
    <AppShell
      groups={buildSuperAdminNav()}
      dark
      appName="Navigation Super Admin"
      userLine={<span className="hidden text-sm text-slate-400 sm:inline">Plateforme</span>}
      headerBell={<NotificationBell dark />}
      extraHeader={
        <a href="/app" className="text-sm text-slate-300 hover:text-white">
          Espace entreprise
        </a>
      }
      onLogout={onLogout}
    />
  );
}
