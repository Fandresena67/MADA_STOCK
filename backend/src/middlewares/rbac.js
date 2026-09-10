const db = require('../config/db');

/**
 * Recharge l'utilisateur depuis la base à chaque requête sensible.
 * Le rôle/tenant du JWT ne sont JAMAIS suffisants seuls : seule la base décide.
 * Expose req.authUser = { id, companyId, role, permissions[] } (frais).
 */
async function attachFreshUser(req, res, next) {
  try {
    const res0 = await db.query(
      `SELECT u.id, u.company_id, u.role, u.is_active, c.is_active AS company_active
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1 LIMIT 1`,
      [req.user.id]
    );
    const row = res0.rows[0];
    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    // Entreprise désactivée : blocage global immédiat (super_admin hors tenant exclu).
    if (row.company_id !== null && row.company_active === false) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const tokenCompany = req.user.companyId ?? null;
    if (tokenCompany !== row.company_id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    let codes = [];
    if (row.role === 'employee') {
      const p = await db.query(
        `SELECT p.code FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = $1`,
        [row.id]
      );
      codes = p.rows.map((r) => r.code);
    }
    const { resolvePermissions } = require('../rbac/permissions');
    req.authUser = {
      id: row.id,
      companyId: row.company_id,
      role: row.role,
      permissions: resolvePermissions(row.role, codes),
    };
    req.user = { id: row.id, companyId: row.company_id, role: row.role }; // frais, pas JWT
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Exige un contexte tenant (rejette le super_admin sur les routes métier). */
function requireTenant(req, res, next) {
  if (!req.authUser || req.authUser.companyId === null || req.authUser.companyId === undefined) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    return next();
  };
}

/** Exige TOUTES les permissions listées. super_admin ('*') passe partout. */
function requirePermission(...codes) {
  return (req, res, next) => {
    const perms = req.authUser?.permissions || [];
    if (perms.includes('*')) return next();
    const ok = codes.every((c) => perms.includes(c));
    if (!ok) return res.status(403).json({ error: 'Accès refusé' });
    return next();
  };
}

module.exports = { attachFreshUser, requireTenant, requireRole, requirePermission };
