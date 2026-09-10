/** Format centralisé Ariary. Accepte number/string/BigInt (montants API = strings exactes). */
export function formatMGA(value) {
  if (value === null || value === undefined || value === '') return '—';
  try {
    const n = typeof value === 'bigint' ? value : BigInt(String(value).split('.')[0]);
    return new Intl.NumberFormat('fr-MG').format(n).replace(/\u202F|\u00A0/g, ' ') + ' Ar';
  } catch {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('fr-MG').format(Math.trunc(n)).replace(/\u202F|\u00A0/g, ' ') + ' Ar';
  }
}

export function stockStatusStyle(status) {
  if (status === 'RUPTURE') return 'bg-red-100 text-red-700';
  if (status === 'FAIBLE') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}
