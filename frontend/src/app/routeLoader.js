import { lazy } from 'react';

/**
 * Import de route avec une seule relance en cas d'échec transitoire
 * (réseau instable lors de clics rapides). Le code splitting est conservé :
 * chaque route reste un chunk dynamique séparé. Si la relance échoue
 * (chunk obsolète après mise à jour), l'erreur remonte au Error Boundary
 * qui propose de recharger l'application.
 */
export function lazyRetry(importFn, delayMs = 800) {
  return lazy(() =>
    importFn().catch(
      (firstError) =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            importFn().then(resolve, (secondError) => reject(secondError || firstError));
          }, delayMs);
        })
    )
  );
}
