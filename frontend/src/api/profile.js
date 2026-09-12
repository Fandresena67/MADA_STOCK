import api, { resolveAssetUrl } from './client';

/** URL affichable de l'avatar (null si aucun). */
export function avatarSrc(avatarUrl) {
  return resolveAssetUrl(avatarUrl);
}

/** Modifie le nom de l'utilisateur connecté. */
export async function updateMyName(name) {
  const { data } = await api.patch('/profile', { name });
  return data.data; // { id, name }
}

/** Envoie la photo de l'utilisateur connecté (FormData, champ `avatar`). */
export async function uploadMyAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await api.patch('/profile/avatar', form);
  return data.data; // { avatarUrl }
}

/** Supprime la photo de l'utilisateur connecté (retour aux initiales). */
export async function deleteMyAvatar() {
  const { data } = await api.delete('/profile/avatar');
  return data.data; // { avatarUrl: null }
}
