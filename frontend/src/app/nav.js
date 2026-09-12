/** Groupes de navigation filtrés par permissions (backend reste l'autorité). */
export function buildAppNav(can) {
  const groups = [
    {
      label: 'Principal',
      items: [
        { to: '/app', label: 'Accueil', icon: 'home', end: true },
        { to: '/app/dashboard', label: 'Dashboard', icon: 'dashboard', perm: 'dashboard.view' },
      ],
    },
    {
      label: 'Inventaire',
      items: [
        { to: '/app/products', label: 'Produits', icon: 'products', perm: 'products.view' },
        { to: '/app/categories', label: 'Catégories', icon: 'categories', perm: 'categories.view' },
        { to: '/app/inventory', label: 'Inventaire', icon: 'inventory', anyOf: ['products.view', 'stock.view'] },
        { to: '/app/movements', label: 'Mouvements', icon: 'movements', perm: 'stock.view' },
      ],
    },
    {
      label: 'Commerce',
      items: [
        { to: '/app/suppliers', label: 'Fournisseurs', icon: 'suppliers', perm: 'suppliers.view' },
        { to: '/app/customers', label: 'Clients', icon: 'customers', perm: 'customers.view' },
        { to: '/app/purchases', label: 'Achats', icon: 'purchases', perm: 'purchases.view' },
        { to: '/app/sales', label: 'Ventes', icon: 'sales', perm: 'sales.view' },
        { to: '/app/invoices', label: 'Factures', icon: 'invoices', perm: 'invoices.view' },
      ],
    },
    {
      label: 'Analyse',
      items: [
        { to: '/app/reports', label: 'Rapports', icon: 'reports', perm: 'reports.view' },
        { to: '/app/alerts', label: 'Alertes', icon: 'alerts', perm: 'alerts.view' },
      ],
    },
    {
      label: 'Système',
      items: [
        { to: '/app/users', label: 'Équipe', icon: 'team', perm: 'users.view' },
        { to: '/app/settings', label: 'Paramètres', icon: 'settings', perm: 'settings.view' },
      ],
    },
  ];
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.perm && !i.anyOf ? true : i.perm ? can(i.perm) : i.anyOf.some((p) => can(p))),
    }))
    .filter((g) => g.items.length > 0);
}

export function buildSuperAdminNav() {
  return [
    {
      label: 'Plateforme',
      items: [
        { to: '/superadmin/dashboard', label: 'Vue globale', icon: 'dashboard', end: true },
        { to: '/superadmin/companies', label: 'Entreprises', icon: 'companies' },
        { to: '/superadmin/users', label: 'Utilisateurs', icon: 'customers' },
        { to: '/superadmin/audit', label: 'Audit global', icon: 'audit' },
      ],
    },
  ];
}
