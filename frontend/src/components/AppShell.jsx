import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { OnlineStatus, UpdateBanner, useServiceWorker } from '../components/Pwa';

/**
 * Coquille SaaS : sidebar fixe desktop / drawer mobile + header + contenu + footer.
 * Utilisée par l'espace entreprise et le Super Admin (menus et thèmes distincts).
 */
export function AppShell({ groups, dark, userLine, extraHeader, headerBell, onLogout, appName, loadingNav, sidebarFooter, sidebarBadges }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('madastock_sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { updateAvailable, applyUpdate } = useServiceWorker();

  useEffect(() => {
    localStorage.setItem('madastock_sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      <OnlineStatus />
      {updateAvailable && <UpdateBanner onUpdate={applyUpdate} />}
      <Sidebar
        groups={groups}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={() => setMobileOpen(false)}
        dark={dark}
        appName={appName}
        footer={sidebarFooter}
        badges={sidebarBadges}
      />
      <div className={`flex min-h-screen flex-col transition-[margin] ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-60'}`}>
        <header className={`sticky top-0 z-20 border-b print:hidden ${dark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <button
              className={`rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
            <span className="font-bold lg:hidden">MADA STOCK</span>
            <div className="ml-auto flex items-center gap-3">
              {headerBell}
              {extraHeader}
              {userLine}
              <button
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={onLogout}
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <LogOut size={18} aria-hidden="true" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          {loadingNav ? <p className="p-8 text-sm text-slate-500" role="status">Chargement de la navigation…</p> : (
            <RouteErrorBoundary key={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          )}
        </main>
        <footer className={`border-t print:hidden ${dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <p className={`mx-auto max-w-6xl px-4 py-3 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            MADA STOCK — gestion de stock · Ariary (MGA)
          </p>
        </footer>
      </div>
    </div>
  );
}
