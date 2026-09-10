import { useEffect, useState } from 'react';
import { me } from '../api/auth';

/** Permissions de l'utilisateur connecté (source : /auth/me). */
export function usePermissions() {
  const [state, setState] = useState({ loading: true, permissions: [], role: null });

  useEffect(() => {
    me()
      .then((u) => setState({ loading: false, permissions: u.permissions || [], role: u.role }))
      .catch(() => setState({ loading: false, permissions: [], role: null }));
  }, []);

  function can(code) {
    if (state.permissions.includes('*')) return true;
    return state.permissions.includes(code);
  }

  return { ...state, can };
}
