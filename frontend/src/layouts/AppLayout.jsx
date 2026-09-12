import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, User, Settings, LogOut, ChevronUp } from 'lucide-react';
import { getAccessToken, setAccessToken } from '../api/client';
import { logout as apiLogout, refresh as apiRefresh, me } from '../api/auth';
import { avatarSrc } from '../api/profile';
import { alertsList } from '../api/stats';
import { usePermissions } from '../hooks/usePermissions';
import { buildAppNav } from '../app/nav';
import { AppShell } from '../components/AppShell';
import { NotificationBell } from '../components/NotificationBell';
import { Avatar, roleLabel } from '../components/ui';

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

/** Bloc profil bas de sidebar : avatar (photo ou initiales) + menu (profil, paramètres, déconnexion). */
function SidebarProfile({ user, can, onLogout }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open ]);

  const itemClass =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <div ref={boxRef} className="relative">
      {open && (
        <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" role="menu" aria-label="Menu du profil">
          <Link to="/app/profile" onClick={() => setOpen(false)} role="menuitem" className={itemClass}>
            <User size={16} aria-hidden="true" />Mon profil
          </Link>
          {can('settings.view') && (
            <Link to="/app/settings" onClick={() => setOpen(false)} role="menuitem" className={itemClass}>
              <Settings size={16} aria-hidden="true" />Paramètres
            </Link>
          )}
          <button onClick={onLogout} role="menuitem" className={itemClass}>
            <LogOut size={16} aria-hidden="true" />Déconnexion
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu du profil"
        title={`${user.name} — ${user.email}`}
        className="flex w-full items-center gap-2 rounded-lg p-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Avatar name={user.name} email={user.email} src={avatarSrc(user.avatarUrl)} size="sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-xs font-semibold text-slate-800">{user.name}</span>
          <span className="block truncate text-[11px] text-slate-500">{user.company?.name || roleLabel(user.role)}</span>
        </span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">{roleLabel(user.role)}</span>
        <ChevronUp size={14} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}

export function AppLayout() {
  const [user, setUser] = useState(null);
  const { can, loading } = usePermissions();
  const alertsQuery = useQuery({
    queryKey: ['alerts', 'count'],
    queryFn: () => alertsList({ limit: 200 }),
    enabled: can('alerts.view'),
    staleTime: 60 * 1000,
  });
  const alertCount = Array.isArray(alertsQuery.data) ? alertsQuery.data.length : 0;

  useEffect(() => {
    function reloadUser() {
      me().then(setUser).catch(() => {});
    }
    reloadUser();
    // La page profil signale tout changement (avatar, nom).
    window.addEventListener('profile-updated', reloadUser);
    return () => window.removeEventListener('profile-updated', reloadUser);
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
    <AppShell
      groups={buildAppNav(can)}
      loadingNav={loading}
      appName="Navigation MADA STOCK"
      sidebarBadges={alertCount > 0 ? { '/app/alerts': alertCount } : undefined}
      headerBell={<NotificationBell />}
      sidebarFooter={user && <SidebarProfile user={user} can={can} onLogout={onLogout} />}
      userLine={
        user && (
          <span className="hidden text-sm text-slate-500 sm:inline" title={user.email}>
            {user.company?.name}
          </span>
        )
      }
      extraHeader={
        user?.role === 'super_admin' ? (
          <a href="/superadmin/dashboard" className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700">
            <ShieldCheck size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Super Admin</span>
          </a>
        ) : null
      }
      onLogout={onLogout}
    />
  );
}
