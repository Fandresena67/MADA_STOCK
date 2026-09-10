import { useEffect, useState } from 'react';

/** Enregistre le SW (production uniquement) + expose les mises à jour. */
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.DEV) return; // SW désactivé en dev (évite le cache fantôme)
    let cancelled = false;
    import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        onNeedRefresh() {
          setRegistration(updateSW);
          setUpdateAvailable(true);
        },
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate() {
    if (registration) registration(true);
    else window.location.reload();
  }

  return { updateAvailable, applyUpdate };
}

/** Bannière hors-ligne honnête : lecture possible du cache statique, mais toute
 *  opération critique exige une connexion (aucune écriture offline silencieuse). */
export function OnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white" role="alert">
      Vous êtes hors ligne — connexion Internet requise pour effectuer toute opération.
    </div>
  );
}

export function UpdateBanner({ onUpdate }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-primary-600 px-4 py-2 text-sm text-white" role="status">
      <span>Une nouvelle version est disponible.</span>
      <button onClick={onUpdate} className="rounded bg-white px-3 py-1 font-semibold text-primary-700">
        Recharger
      </button>
    </div>
  );
}
