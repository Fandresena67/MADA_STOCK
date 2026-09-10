/**
 * Statut de stock — SOURCE UNIQUE (utilisée en SQL et en JS, règles identiques) :
 *   quantity = 0                        → RUPTURE
 *   quantity > 0 AND quantity <= min     → FAIBLE
 *   quantity > min                      → NORMAL
 */

function stockStatus(quantity, minStock) {
  const q = Number(quantity);
  const m = Number(minStock);
  if (q === 0) return 'RUPTURE';
  if (q <= m) return 'FAIBLE';
  return 'NORMAL';
}

/** Fragment SQL CASE réutilisable (colonnes quantity / min_stock du scope courant). */
const STOCK_STATUS_CASE = `CASE
  WHEN quantity = 0 THEN 'RUPTURE'
  WHEN quantity <= min_stock THEN 'FAIBLE'
  ELSE 'NORMAL'
END`;

module.exports = { stockStatus, STOCK_STATUS_CASE };
