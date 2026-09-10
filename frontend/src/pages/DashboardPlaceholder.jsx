import { useEffect, useState } from 'react';
import { me } from '../api/auth';

export default function DashboardPlaceholder() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    me().then(setUser).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Espace entreprise</h1>
      <p className="mt-2 text-slate-600">
        Socle sécurisé multi-tenant OK. Le Dashboard professionnel arrivera à l'étape dédiée.
      </p>
      {user && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p>
            <strong>{user.name}</strong> — {user.email} ({user.role})
          </p>
          <p className="text-slate-500">
            Entreprise : {user.company?.name} · Monnaie : {user.company?.currency}
          </p>
          <p className="mt-2 text-slate-500">
            Permissions ({user.permissions?.length ?? 0}) :{' '}
            <span className="text-slate-700">{(user.permissions || []).slice(0, 8).join(', ')}{user.permissions?.length > 8 ? '…' : ''}</span>
          </p>
        </div>
      )}
    </div>
  );
}
