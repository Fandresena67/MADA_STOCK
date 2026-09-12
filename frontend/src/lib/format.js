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

/**
 * Parse une saisie de montant Ariary : accepte "2000000", "2 000 000",
 * "2 000 000 Ar" (espaces classiques et insécables incluses) ou "2000000Ar".
 * Retourne l'entier sûr correspondant, ou NaN si la saisie n'est pas un
 * entier positif (décimaux, lettres et signes refusés — comme le backend).
 */
export function parseMGAInput(value) {
  if (value === null || value === undefined) return NaN;
  let s = String(value).trim().replace(/[\s\u00A0\u202F\u2007\u2060\uFEFF]/g, '');
  if (s === '') return NaN;
  s = s.replace(/(Ar|MGA|ariary)$/i, '');
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
}

/** Forme d'affichage d'une saisie : "2000000" → "2 000 000 Ar" (inchangée si invalide). */
export function formatPriceInput(value) {
  const n = parseMGAInput(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return formatMGA(n);
}

/** Forme éditable d'une saisie : "2 000 000 Ar" → "2000000" (inchangée si invalide). */
export function unformatPriceInput(value) {
  const n = parseMGAInput(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return String(n);
}

export function stockStatusStyle(status) {
  if (status === 'RUPTURE') return 'bg-red-100 text-red-700';
  if (status === 'FAIBLE') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

/**
 * Normalise un site web saisi sans protocole pour un affichage cliquable sûr.
 * Retourne null si vide. Le lien rendu doit ajouter rel="noopener noreferrer".
 */
export function normalizeUrl(value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(v)) return `https://${v}`;
  return null;
}
