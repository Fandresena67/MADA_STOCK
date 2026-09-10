/**
 * Référence unique des permissions (miroir du seed 002_rbac.sql).
 * company_admin : toutes ces permissions implicitement (scope entreprise).
 * employee : uniquement les permissions explicites de user_permissions.
 * super_admin : '*' (routes /superadmin/*, hors tenant).
 */
const PERMISSION_CODES = [
  'users.view', 'users.create', 'users.update', 'users.delete',
  'roles.view', 'roles.manage',
  'products.view', 'products.create', 'products.update', 'products.delete',
  'categories.view', 'categories.create', 'categories.update', 'categories.delete',
  'stock.view', 'stock.in', 'stock.out', 'stock.adjust', 'stock.transfer',
  'suppliers.view', 'suppliers.manage',
  'customers.view', 'customers.manage',
  'sales.view', 'sales.create', 'sales.update', 'sales.cancel', 'sales.confirm',
  'purchases.view', 'purchases.create', 'purchases.update', 'purchases.cancel', 'purchases.confirm',
  'invoices.view', 'invoices.create', 'invoices.update',
  'reports.view', 'alerts.view', 'dashboard.view',
  'settings.view', 'settings.update',
  'audit.view',
];

function isKnownPermission(code) {
  return PERMISSION_CODES.includes(code);
}

/**
 * Résout les permissions effectives d'un utilisateur.
 * - super_admin -> ['*']
 * - company_admin -> toutes les permissions tenant (implicite, documenté)
 * - employee -> permissions explicites uniquement
 */
function resolvePermissions(role, explicitCodes) {
  if (role === 'super_admin') return ['*'];
  if (role === 'company_admin') return [...PERMISSION_CODES];
  return (explicitCodes || []).filter(isKnownPermission);
}

module.exports = { PERMISSION_CODES, isKnownPermission, resolvePermissions };
