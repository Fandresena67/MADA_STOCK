import { useCallback, useEffect, useRef, useState } from 'react';
import {
  User, Building2, ShieldCheck, Camera, Trash2, X, ImagePlus,
  Pencil, Eye, EyeOff, KeyRound, MonitorSmartphone, LogOut,
} from 'lucide-react';
import { me, changeMyPassword, listMySessions, revokeMySession, logoutAllDevices } from '../api/auth';
import { setAccessToken } from '../api/client';
import { uploadMyAvatar, deleteMyAvatar, updateMyName, avatarSrc } from '../api/profile';
import { PageHeader, Loading, ErrorBox } from '../components/common';
import { Avatar, Button, Card, CardTitle, Field, TextInput, roleLabel } from '../components/ui';

const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const ACCEPT = '.jpg,.jpeg,.png,.webp';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

/** Signale au layout (sidebar/header) que le profil a changé. */
export function notifyProfileUpdated() {
  window.dispatchEvent(new Event('profile-updated'));
}

function validateFile(file) {
  if (!file) return 'Aucune photo fournie.';
  const ext = `.${(file.name || '').split('.').pop().toLowerCase()}`;
  if (!ALLOWED_MIME.includes(file.type) || !ALLOWED_EXT.includes(ext)) {
    return 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.';
  }
  if (file.size > MAX_SIZE) return 'La photo ne doit pas dépasser 5 Mo.';
  if (file.size === 0) return 'Fichier invalide.';
  return '';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Libellé honnête : navigateur/OS devinés, UA brute en infobulle. */
function deviceLabel(ua) {
  if (!ua) return 'Appareil inconnu';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : null;
  const nav = /Edg\//i.test(ua) ? 'Edge' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : null;
  return [nav, os].filter(Boolean).join(' · ') || 'Navigateur inconnu';
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Photo
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);

  // Nom
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Mot de passe
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [revokingId, setRevokingId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const reloadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      setSessions(await listMySessions());
    } catch (err) {
      setSessionsError(err.response?.data?.error || 'Chargement des sessions impossible');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    me()
      .then((u) => {
        setUser(u);
        setNameValue(u.name || '');
      })
      .catch((err) => setError(err.response?.data?.error || 'Chargement impossible'))
      .finally(() => setLoading(false));
    reloadSessions();
  }, [reloadSessions]);

  // Nettoie l'URL d'aperçu à chaque changement / démontage.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function flash(msg) {
    setNotice(msg);
  }

  // ---------------- Photo (inchangée) ----------------

  function pickFile() {
    setPhotoError('');
    inputRef.current?.click();
  }

  function onSelect(e) {
    const chosen = e.target.files?.[0] || null;
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!chosen) return;
    const problem = validateFile(chosen);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setPhotoError('');
    setNotice('');
  }

  function cancelPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setPhotoError('');
  }

  async function savePhoto() {
    if (!file || saving) return;
    setSaving(true);
    setPhotoError('');
    try {
      const result = await uploadMyAvatar(file);
      setUser((u) => (u ? { ...u, avatarUrl: result.avatarUrl } : u));
      cancelPreview();
      flash('Photo de profil mise à jour.');
      notifyProfileUpdated(); // rafraîchit la sidebar
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Envoi impossible. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto() {
    if (deleting) return;
    if (!window.confirm('Supprimer votre photo de profil ?')) return;
    setDeleting(true);
    setPhotoError('');
    try {
      const result = await deleteMyAvatar();
      setUser((u) => (u ? { ...u, avatarUrl: result.avatarUrl } : u));
      cancelPreview();
      flash('Photo de profil supprimée.');
      notifyProfileUpdated(); // rafraîchit la sidebar
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Suppression impossible. Réessayez.');
    } finally {
      setDeleting(false);
    }
  }

  // ---------------- Nom ----------------

  function startEditName() {
    setNameValue(user.name || '');
    setNameError('');
    setEditingName(true);
  }

  async function saveName(e) {
    e.preventDefault();
    if (savingName) return;
    const clean = (nameValue || '').trim();
    if (clean.length < 2) {
      setNameError('Nom : 2 caractères minimum.');
      return;
    }
    if (clean.length > 255) {
      setNameError('Nom trop long (255 caractères maximum).');
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      const result = await updateMyName(clean);
      setUser((u) => (u ? { ...u, name: result.name } : u));
      setEditingName(false);
      flash('Nom mis à jour.');
      notifyProfileUpdated(); // rafraîchit la sidebar
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setNameError(details || err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setSavingName(false);
    }
  }

  // ---------------- Mot de passe ----------------

  function setPwField(key, value) {
    setPw((p) => ({ ...p, [key]: value }));
  }

  async function savePassword(e) {
    e.preventDefault();
    if (savingPw) return;
    if (!pw.current) {
      setPwError('Mot de passe actuel requis.');
      return;
    }
    if (!pw.next) {
      setPwError('Nouveau mot de passe requis.');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSavingPw(true);
    setPwError('');
    try {
      const result = await changeMyPassword({ currentPassword: pw.current, newPassword: pw.next, confirmPassword: pw.confirm });
      setPw({ current: '', next: '', confirm: '' });
      flash(
        result.revokedSessions > 0
          ? 'Mot de passe modifié. Les autres appareils ont été déconnectés.'
          : 'Mot de passe modifié.'
      );
      reloadSessions();
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setPwError(details || err.response?.data?.error || 'Modification impossible.');
    } finally {
      setSavingPw(false);
    }
  }

  // ---------------- Sessions ----------------

  function forceLogin() {
    setAccessToken(null);
    window.location.href = '/login';
  }

  async function revokeSession(s) {
    if (revokingId) return;
    const msg = s.current
      ? 'Révoquer cette session ? Il s’agit de votre session actuelle : vous serez déconnecté.'
      : 'Révoquer cette session ? L’appareil concerné sera déconnecté.';
    if (!window.confirm(msg)) return;
    setRevokingId(s.id);
    try {
      await revokeMySession(s.id);
      if (s.current) {
        forceLogin();
        return;
      }
      flash('Session révoquée.');
      reloadSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Révocation impossible.');
    } finally {
      setRevokingId(null);
    }
  }

  async function logoutAll() {
    if (loggingOutAll) return;
    if (!window.confirm('Voulez-vous vraiment déconnecter tous les appareils, y compris celui-ci ?')) return;
    setLoggingOutAll(true);
    try {
      await logoutAllDevices();
    } catch {
      // Même en cas d'erreur réseau, la session locale ne doit pas survivre.
    } finally {
      forceLogin(); // toutes les sessions sont révoquées côté serveur
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const activeCount = sessions.length;

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Vos informations personnelles, votre photo et votre sécurité" />
      {notice && <p className="mb-4 max-w-3xl rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <div className="grid max-w-3xl grid-cols-1 gap-4">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start">
              <Avatar name={user.name} email={user.email} src={avatarSrc(user.avatarUrl)} size="lg" />
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary-600 text-white"
                aria-hidden="true"
              >
                <Camera size={11} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{user.name}</h2>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
              <p className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {roleLabel(user.role)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={pickFile} icon={<Camera size={15} aria-hidden="true" />}>
                Changer la photo
              </Button>
              {user.avatarUrl && (
                <Button
                  size="sm"
                  variant="dangerOutline"
                  onClick={removePhoto}
                  loading={deleting}
                  icon={<Trash2 size={15} aria-hidden="true" />}
                >
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle action={<User size={18} aria-hidden="true" className="text-slate-400" />}>
            Informations personnelles
          </CardTitle>
          {!editingName ? (
            <>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Nom</dt>
                  <dd className="font-semibold">{user.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="break-words font-semibold">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Rôle</dt>
                  <dd className="font-semibold">{roleLabel(user.role)}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={startEditName} icon={<Pencil size={15} aria-hidden="true" />}>
                  Modifier
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={saveName} className="space-y-3">
              <Field label="Nom" required error={nameError}>
                <TextInput
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  maxLength={255}
                  autoFocus
                  aria-label="Votre nom"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" type="submit" loading={savingName}>
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditingName(false)} icon={<X size={15} aria-hidden="true" />}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </Card>
        <Card>
          <CardTitle action={<Building2 size={18} aria-hidden="true" className="text-slate-400" />}>
            Entreprise
          </CardTitle>
          {user.company ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Nom</dt>
                <dd className="font-semibold">{user.company.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Monnaie</dt>
                <dd className="font-semibold">{user.company.currency} — Ariary</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Compte global — aucune entreprise rattachée.</p>
          )}
        </Card>
        <Card>
          <CardTitle action={<ImagePlus size={18} aria-hidden="true" className="text-slate-400" />}>
            Photo de profil
          </CardTitle>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onSelect}
            className="sr-only"
            aria-label="Choisir une photo de profil (JPG, PNG ou WEBP, 5 Mo maximum)"
          />
          <p className="text-sm text-slate-600">
            Formats acceptés : JPG, PNG, WEBP — 5 Mo maximum. L'aperçu s'affiche avant
            enregistrement ; rien n'est envoyé au serveur tant que vous ne cliquez pas sur Enregistrer.
          </p>
          {preview && (
            <div className="mt-3 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={preview}
                alt="Aperçu de la nouvelle photo de profil"
                className="h-16 w-16 shrink-0 rounded-full object-cover"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{file?.name}</p>
                <p className="text-xs text-slate-500">Aperçu — cliquez sur Enregistrer pour appliquer.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={cancelPreview} icon={<X size={15} aria-hidden="true" />}>
                Annuler
              </Button>
            </div>
          )}
          {photoError && <p className="mt-3 text-sm text-red-600" role="alert">{photoError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!preview ? (
              <Button size="sm" variant="outline" onClick={pickFile} icon={<Camera size={15} aria-hidden="true" />}>
                Choisir une photo
              </Button>
            ) : (
              <Button size="sm" onClick={savePhoto} loading={saving}>
                Enregistrer
              </Button>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle action={<KeyRound size={18} aria-hidden="true" className="text-slate-400" />}>
            Changer le mot de passe
          </CardTitle>
          <form onSubmit={savePassword} className="space-y-3">
            {[
              { key: 'current', label: 'Mot de passe actuel', autoComplete: 'current-password' },
              { key: 'next', label: 'Nouveau mot de passe', autoComplete: 'new-password' },
              { key: 'confirm', label: 'Confirmer le nouveau mot de passe', autoComplete: 'new-password' },
            ].map((f) => (
              <Field key={f.key} label={f.label} required>
                <div className="relative">
                  <TextInput
                    type={showPw ? 'text' : 'password'}
                    value={pw[f.key]}
                    onChange={(e) => setPwField(f.key, e.target.value)}
                    maxLength={128}
                    autoComplete={f.autoComplete}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                    aria-pressed={showPw}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 outline-none hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {showPw ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </Field>
            ))}
            <p className="text-xs text-slate-500">
              8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.
              Les autres appareils seront déconnectés.
            </p>
            {pwError && <p className="text-sm text-red-600" role="alert">{pwError}</p>}
            <Button size="sm" type="submit" loading={savingPw}>
              Changer le mot de passe
            </Button>
          </form>
        </Card>
        <Card>
          <CardTitle action={<MonitorSmartphone size={18} aria-hidden="true" className="text-slate-400" />}>
            Sessions et appareils
          </CardTitle>
          {sessionsLoading ? (
            <p className="py-2 text-sm text-slate-500">Chargement des sessions…</p>
          ) : sessionsError ? (
            <p className="text-sm text-red-600" role="alert">
              {sessionsError}{' '}
              <button onClick={reloadSessions} className="font-semibold underline">
                Réessayer
              </button>
            </p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune session active.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-hidden="true">
                    <MonitorSmartphone size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800" title={s.userAgent || undefined}>
                      {deviceLabel(s.userAgent)}
                      {s.current && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          Cet appareil
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Connectée le {formatDateTime(s.createdAt)}
                      {s.lastUsedAt && s.lastUsedAt !== s.createdAt && ` · active le ${formatDateTime(s.lastUsedAt)}`}
                      {s.ipAddress && ` · ${s.ipAddress}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="dangerOutline"
                    onClick={() => revokeSession(s)}
                    loading={revokingId === s.id}
                    icon={<X size={14} aria-hidden="true" />}
                    aria-label={s.current ? 'Révoquer cette session (vous serez déconnecté)' : 'Révoquer cette session'}
                  >
                    Révoquer
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Button
              size="sm"
              variant="dangerOutline"
              onClick={logoutAll}
              loading={loggingOutAll}
              icon={<LogOut size={15} aria-hidden="true" />}
            >
              Déconnecter tous les appareils
            </Button>
          </div>
        </Card>
        <Card>
          <CardTitle action={<ShieldCheck size={18} aria-hidden="true" className="text-slate-400" />}>
            Sécurité
          </CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Votre compte est protégé par une authentification sécurisée (sessions chiffrées).</li>
            <li>Votre mot de passe est stocké sous forme de hash, jamais en clair.</li>
            <li>
              {activeCount} session{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''} sur votre compte.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
