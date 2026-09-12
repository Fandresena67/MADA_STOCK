import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NavIcon } from './icons';

/**
 * Sidebar SaaS : groupes + icônes + état actif (NavLink, aria-current natif) + filtrage permissions.
 * - Desktop (>= lg) : fixe, collapsible (240px ↔ 68px, tooltips via title).
 * - Mobile/tablette (< lg) : drawer + overlay + Escape.
 */
export function Sidebar({
  groups, collapsed, onToggleCollapse, mobileOpen, onCloseMobile, onNavigate, dark, appName, footer, badges,
}) {
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') onCloseMobile();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const theme = dark
    ? { aside: 'bg-slate-900 text-slate-200', group: 'text-slate-500', link: 'text-slate-300 hover:bg-slate-800', active: 'bg-white text-slate-900', border: 'border-slate-800' }
    : { aside: 'bg-white text-slate-700', group: 'text-slate-400', link: 'text-slate-600 hover:bg-slate-100', active: 'bg-primary-600 text-white', border: 'border-slate-200' };

  function content(compact, inDrawer) {
    return (
      <div className={`flex h-full flex-col ${theme.aside}`}>
        <div className={`flex items-center gap-2 px-4 py-4 ${compact ? 'justify-center px-2' : ''}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white" aria-hidden="true">
            MS
          </span>
          {!compact && (
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-wide">MADA</span>
              <span className="block text-sm font-bold tracking-wide">STOCK</span>
            </span>
          )}
          {inDrawer && (
            <button className="ml-auto rounded-lg p-1.5 hover:bg-slate-100" onClick={onCloseMobile} aria-label="Fermer le menu">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <nav aria-label={appName || 'Navigation principale'} className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.map((g) => (
            <div key={g.label} className="mt-4 first:mt-2">
              {!compact && (
                <p className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider ${theme.group}`}>{g.label}</p>
              )}
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={compact ? item.label : undefined}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          compact ? 'justify-center px-2' : ''
                        } ${isActive ? theme.active : theme.link}`
                      }
                    >
                      <NavIcon name={item.icon} size={18} />
                      {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!compact && badges?.[item.to] > 0 && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-tight ${dark ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}
                          aria-label={`${badges[item.to]} alerte(s)`}
                        >
                          {badges[item.to] > 99 ? '99+' : badges[item.to]}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {!inDrawer && (
          <div className={`border-t px-2 py-2 ${theme.border}`}>
            {footer && !compact && <div className="mb-2 px-1">{footer}</div>}
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
              aria-expanded={!collapsed}
              className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:flex ${theme.link} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? 'Développer' : 'Réduire'}
            >
              {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
              {!collapsed && <span>Réduire</span>}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop : fixe */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r transition-[width] print:hidden lg:block ${theme.border} ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-60'
        }`}
      >
        {content(collapsed, false)}
      </aside>
      {/* Mobile/tablette : drawer */}
      <div className={`fixed inset-0 z-40 print:hidden lg:hidden ${mobileOpen ? '' : 'pointer-events-none invisible'}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onCloseMobile}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r transition-transform ${theme.border} ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={appName || 'Menu'}
        >
          {content(false, true)}
        </aside>
      </div>
    </>
  );
}
