/**
 * Calculs monétaires déterministes (Ariary entiers, BIGINT).
 * line_total = max(0, qty*unit_price − discount) + tax
 * subtotal   = Σ(qty*unit_price)
 * total      = max(0, subtotal − Σdiscounts − docDiscount) + Σtaxes + docTax
 * Calculs en BigInt (aucune perte), sorties en Number (bornées par validation).
 */
const MONEY_MAX = 999999999999;

function toBig(n) {
  return BigInt(Math.trunc(Number(n)));
}

function calcLines(items) {
  let subtotal = 0n;
  let discountTotal = 0n;
  let taxTotal = 0n;
  const lines = items.map((it) => {
    const qty = BigInt(it.quantity);
    const unit = toBig(it.unit_price);
    const disc = toBig(it.discount ?? 0);
    const tax = toBig(it.tax ?? 0);
    const base = qty * unit;
    const lineTotal = (base > disc ? base - disc : 0n) + tax;
    subtotal += base;
    discountTotal += disc;
    taxTotal += tax;
    return { ...it, line_total: Number(lineTotal) };
  });
  return { lines, subtotal, discountTotal, taxTotal };
}

function calcTotals(items, docDiscount = 0, docTax = 0) {
  const { lines, subtotal, discountTotal, taxTotal } = calcLines(items);
  const discAll = discountTotal + toBig(docDiscount);
  const taxAll = taxTotal + toBig(docTax);
  const total = (subtotal > discAll ? subtotal - discAll : 0n) + taxAll;
  return {
    lines,
    subtotal: Number(subtotal),
    discount: Number(discAll),
    tax: Number(taxAll),
    total: Number(total),
  };
}

module.exports = { MONEY_MAX, calcTotals };
