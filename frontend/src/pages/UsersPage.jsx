import { useCallback, useEffect, useRef, useState } from 'react';
import { Users as UsersIcon, Plus, Pencil, KeyRound, MonitorSmartphone, Camera, Trash2, ShieldCheck } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { me as fetchMe } from '../api/auth';
import {
  listUsers, getUser, createUser, patchUser, setUserStatus,
  getUserPermissions, setUserPermissions, adminResetPassword,
  listUserSessions, revokeUserSessions, uploadUserAvatar, deleteUserAvatar,
  userAvatarSrc,
} from '../api/users';
import {
  PageHeader, Loading, ErrorBox, Pagination, SearchInput, Modal,
  Table, Thead, Th, Td, EmptyState, FilterButton, SegmentedGroup,
} from '../components/common';
import { Avatar, Button, Card, CardTitle, Field, TextInput, Select, roleLabel } from '../components/ui';

/** Groupes de permissions (miroir exact des 42 codes backend). */
const PERM_GROUPS = [
  { label: 'Utilisateurs', codes: ['users.view', 'users.create', 'users.update', 'users.delete'] },
  { label: 'Rôles', codes: ['roles.view', 'roles.manage'] },
  { label: 'Produits', codes: ['products.view', 'products.create', 'products.update', 'products.delete'] },
  { label: 'Catégories', codes: ['categories.view', 'categories.create', 'categories.update', 'categories.delete'] },
  { label: 'Stock', codes: ['stock.view', 'stock.in', 'stock.out', 'stock.adjust', 'stock.transfer'] },
  { label: 'Fournisseurs', codes: ['suppliers.view', 'suppliers.manage'] },
  { label: 'Clients', codes: ['customers.view', 'customers.manage'] },
  { label: 'Ventes', codes: ['sales.view', 'sales.create', 'sales.update', 'sales.cancel', 'sales.confirm'] },
  { label: 'Achats', codes: ['purchases.view', 'purchases.create', 'purchases.update', 'purchases.cancel', 'purchases.confirm'] },
  { label: 'Factures', codes: ['invoices.view', 'invoices.create', 'invoices.update'] },
  { label: 'Analyse', codes: ['reports.view', 'alerts.view', 'dashboard.view'] },
  { label: 'Système', codes: ['settings.view', 'settings.update', 'audit.view'] },
];

const SHORT_LABEL = {
  view: 'Voir', create: 'Créer', update: 'Modifier', delete: 'Supprimer',
  manage: 'Gérer', in: 'Entrées', out: 'Sorties', adjust: 'Ajustements',
  transfer: 'Transferts', cancel: 'Annuler', confirm: 'Confirmer',
};

function permShortLabel(code) {
  return SHORT_LABEL[code.split('.')[1]] || code;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-MG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function lastActivityLabel(u) {
  const at = u.lastActivityAt || u.lastLoginAt;
  if (!at) return 'Jamais connecté';
  return formatDateTime(at);
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

const ACCEPT = '.jpg,.jpeg,.png,.webp';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE = 5 * 1024 * 1024;

function validateImage(file) {
  if (!file) return 'Aucune photo fournie.';
  const ext = `.${(file.name || '').split('.').pop().toLowerCase()}`;
  if (!ALLOWED_MIME.includes(file.type) || !ALLOWED_EXT.includes(ext)) {
    return 'Format non pris en charge. Utilisez JPG, PNG ou WEBP.';
  }
  if (file.size > MAX_SIZE) return 'La photo ne doit pas dépasser 5 Mo.';
  if (file.size === 0) return 'Fichier invalide.';
  return '';
}

function PermissionsEditor({ value, onChange, disabled }) {
  function toggle(code) {
    if (disabled) return;
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  }
  function toggleGroup(codes) {
    if (disabled) return;
    const all = codes.every((c) => value.includes(c));
    onChange(all ? value.filter((c) => !codes.includes(c)) : [...new Set([...value, ...codes])]);
  }
  return (
    <div className="space-y-4">
      {PERM_GROUPS.map((g) => {
        const checked = g.codes.filter((c) => value.includes(c)).length;
        return (
          <fieldset key={g.label} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <legend className="px-1 text-sm font-semibold text-slate-800">{g.label}</legend>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleGroup(g.codes)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
              >
                {checked === g.codes.length ? 'Tout retirer' : 'Tout sélectionner'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {g.codes.map((code) => (
                <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={value.includes(code)}
                    disabled={disabled}
                    onChange={() => toggle(code)}
                    className="h-4 w-4 shrink-0 accent-primary-600"
                  />
                  <span>{permShortLabel(code)}</span>
                  <span className="truncate text-xs text-slate-400">{code}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const { can } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', confirm: '', permissions: [] });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState(null); // utilisateur enrichi
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [perms, setPerms] = useState([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsError, setPermsError] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [pwTarget, setPwTarget] = useState(null);
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

  const canCreate = can('users.create');
  const canUpdate = can('users.update');
  const canManageRoles = can('roles.manage');

  useEffect(() => {
    fetchMe().then(setCurrentUser).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      const res = await listUsers(params);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  function setFilter(k, v) {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  }

  function flash(msg) {
    setNotice(msg);
  }

  async function openDetail(id) {
    setDetailLoading(true);
    setDetail(null);
    setEditing(false);
    setEditError('');
    setPerms([]);
    setPermsError('');
    setSessions([]);
    setAvatarError('');
    try {
      const u = await getUser(id);
      setDetail(u);
      setEditForm({ name: u.name || '', email: u.email || '' });
      setPerms(u.permissions || []);
      loadSessions(id);
    } catch (err) {
      alert(err.response?.data?.error || 'Utilisateur introuvable.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadSessions(id) {
    setSessionsLoading(true);
    try {
      setSessions(await listUserSessions(id));
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function refreshPerms(id) {
    setPermsLoading(true);
    setPermsError('');
    try {
      const r = await getUserPermissions(id);
      setPerms(r.permissions || []);
      return r;
    } catch (err) {
      setPermsError(err.response?.data?.error || 'Chargement des permissions impossible');
      return null;
    } finally {
      setPermsLoading(false);
    }
  }

  async function submitCreate(e) {
    e.preventDefault();
    if (creating) return;
    const name = createForm.name.trim();
    if (name.length < 2) {
      setCreateError('Nom : 2 caractères minimum.');
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError('Email requis.');
      return;
    }
    if (createForm.password !== createForm.confirm) {
      setCreateError('La confirmation ne correspond pas au mot de passe.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await createUser({
        name,
        email: createForm.email.trim(),
        password: createForm.password,
        permissions: createForm.permissions,
      });
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', confirm: '', permissions: [] });
      flash('Employé créé.');
      setPage(1);
      load();
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setCreateError(details || err.response?.data?.error || 'Création impossible.');
    } finally {
      setCreating(false);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (savingEdit || !detail) return;
    const name = editForm.name.trim();
    if (name.length < 2) {
      setEditError('Nom : 2 caractères minimum.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const payload = {};
      if (name !== detail.name) payload.name = name;
      if (editForm.email.trim().toLowerCase() !== detail.email.toLowerCase()) payload.email = editForm.email.trim();
      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }
      const updated = await patchUser(detail.id, payload);
      setDetail((d) => ({ ...d, ...updated }));
      setEditing(false);
      flash('Utilisateur mis à jour.');
      load();
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setEditError(details || err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleStatus(u) {
    const target = detail && detail.id === u.id ? detail : u;
    const isSelf = currentUser && currentUser.id === target.id;
    if (isSelf) {
      alert('Impossible de désactiver votre propre compte.');
      return;
    }
    const next = !(target.isActive ?? target.is_active);
    if (!window.confirm(`Voulez-vous vraiment ${next ? 'réactiver' : 'désactiver'} « ${target.email} » ?${!next ? ' Ses sessions seront révoquées.' : ''}`)) return;
    setToggling(true);
    try {
      const updated = await setUserStatus(target.id, next);
      flash(next ? 'Compte réactivé.' : 'Compte désactivé. Ses sessions ont été révoquées.');
      if (detail && detail.id === target.id) {
        setDetail((d) => ({ ...d, ...updated }));
        loadSessions(target.id);
      }
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Impossible de modifier le statut.');
    } finally {
      setToggling(false);
    }
  }

  async function submitPerms() {
    if (savingPerms || !detail) return;
    setSavingPerms(true);
    setPermsError('');
    try {
      const r = await setUserPermissions(detail.id, perms);
      setPerms(r.permissions || perms);
      flash('Permissions mises à jour.');
    } catch (err) {
      setPermsError(err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setSavingPerms(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    if (savingPw || !pwTarget) return;
    if (pwForm.next !== pwForm.confirm) {
      setPwError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSavingPw(true);
    setPwError('');
    try {
      const r = await adminResetPassword(pwTarget.id, { newPassword: pwForm.next, confirmPassword: pwForm.confirm });
      setPwTarget(null);
      setPwForm({ next: '', confirm: '' });
      flash(`Mot de passe réinitialisé. ${r.revokedSessions || 0} session(s) révoquée(s).`);
      if (detail && detail.id === pwTarget.id) loadSessions(pwTarget.id);
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setPwError(details || err.response?.data?.error || 'Réinitialisation impossible.');
    } finally {
      setSavingPw(false);
    }
  }

  async function revokeAll(id) {
    if (revokingSessions) return;
    if (!window.confirm('Révoquer toutes les sessions de cet employé ? Il devra se reconnecter.')) return;
    setRevokingSessions(true);
    try {
      const r = await revokeUserSessions(id);
      flash(`${r.revokedSessions || 0} session(s) révoquée(s).`);
      loadSessions(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Révocation impossible.');
    } finally {
      setRevokingSessions(false);
    }
  }

  function pickAvatar() {
    setAvatarError('');
    avatarInputRef.current?.click();
  }

  async function onAvatarSelect(e, userId) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setAvatarError(problem);
      return;
    }
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const r = await uploadUserAvatar(userId, file);
      setDetail((d) => (d ? { ...d, avatarUrl: r.avatarUrl } : d));
      flash('Photo mise à jour.');
      load();
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Envoi impossible.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar(userId) {
    if (!window.confirm('Supprimer la photo de cet employé ?')) return;
    setUploadingAvatar(true);
    try {
      const r = await deleteUserAvatar(userId);
      setDetail((d) => (d ? { ...d, avatarUrl: r.avatarUrl } : d));
      flash('Photo supprimée.');
      load();
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Suppression impossible.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const isSelfDetail = detail && currentUser && detail.id === currentUser.id;

  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle="Membres de votre entreprise : rôles, permissions, statut et sécurité"
        action={canCreate && (
          <Button size="sm" onClick={() => { setCreateError(''); setShowCreate(true); }} icon={<Plus size={16} aria-hidden="true" />}>
            Ajouter un employé
          </Button>
        )}
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Nom, email…" ariaLabel="Rechercher un membre par nom ou email" />
        <SegmentedGroup label="Filtrer par rôle">
          <FilterButton active={filters.role === ''} onClick={() => setFilter('role', '')}>Tous</FilterButton>
          <FilterButton active={filters.role === 'company_admin'} onClick={() => setFilter('role', 'company_admin')}>Admins</FilterButton>
          <FilterButton active={filters.role === 'employee'} onClick={() => setFilter('role', 'employee')}>Employés</FilterButton>
        </SegmentedGroup>
        <SegmentedGroup label="Filtrer par statut">
          <FilterButton active={filters.status === ''} onClick={() => setFilter('status', '')}>Tous</FilterButton>
          <FilterButton active={filters.status === 'active'} onClick={() => setFilter('status', 'active')}>Actifs</FilterButton>
          <FilterButton active={filters.status === 'inactive'} onClick={() => setFilter('status', 'inactive')}>Inactifs</FilterButton>
        </SegmentedGroup>
      </div>

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : items.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={22} aria-hidden="true" />}
          title="Aucun membre trouvé"
          message="Modifiez la recherche ou ajoutez un employé."
          action={canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={16} aria-hidden="true" />}>
              Ajouter un employé
            </Button>
          )}
        />
      ) : (
        <Table minWidth="min-w-[760px]">
          <Thead>
            <Th>Utilisateur</Th>
            <Th>Rôle</Th>
            <Th>Statut</Th>
            <Th>Dernière activité</Th>
            <Th right>Actions</Th>
          </Thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <Td>
                  <button
                    onClick={() => openDetail(u.id)}
                    className="flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label={`Voir le détail de ${u.name}`}
                  >
                    <Avatar name={u.name} email={u.email} src={userAvatarSrc(u.avatarUrl)} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{u.name}</span>
                      <span className="block truncate text-xs text-slate-500">{u.email}</span>
                    </span>
                  </button>
                </Td>
                <Td muted>{roleLabel(u.role)}</Td>
                <Td><StatusBadge active={u.isActive ?? u.is_active} /></Td>
                <Td muted>{lastActivityLabel(u)}</Td>
                <Td right>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDetail(u.id)}>Détails</Button>
                    {canUpdate && (
                      <Button
                        size="sm"
                        variant={(u.isActive ?? u.is_active) ? 'dangerOutline' : 'outline'}
                        onClick={() => toggleStatus(u)}
                        loading={toggling}
                      >
                        {(u.isActive ?? u.is_active) ? 'Désactiver' : 'Réactiver'}
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination meta={meta} onPage={setPage} label="Pagination des membres" />

      {showCreate && (
        <Modal title="Ajouter un employé" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-3">
            <Field label="Nom" required error={undefined}>
              <TextInput value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} maxLength={255} autoComplete="off" aria-label="Nom de l'employé" />
            </Field>
            <Field label="Email" required>
              <TextInput type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} maxLength={255} autoComplete="off" aria-label="Email de l'employé" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Mot de passe" required>
                <TextInput type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} maxLength={128} autoComplete="new-password" aria-label="Mot de passe initial" />
              </Field>
              <Field label="Confirmation" required>
                <TextInput type="password" value={createForm.confirm} onChange={(e) => setCreateForm((f) => ({ ...f, confirm: e.target.value }))} maxLength={128} autoComplete="new-password" aria-label="Confirmer le mot de passe" />
              </Field>
            </div>
            <p className="text-xs text-slate-500">8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre. Rôle : Employé.</p>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Permissions initiales (optionnel)</p>
              <PermissionsEditor value={createForm.permissions} onChange={(v) => setCreateForm((f) => ({ ...f, permissions: v }))} />
            </div>
            {createError && <p className="text-sm text-red-600" role="alert">{createError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={creating}>Créer l'employé</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            </div>
          </form>
        </Modal>
      )}

      {detailLoading && (
        <Modal title="Chargement…" onClose={() => setDetailLoading(false)}>
          <Loading />
        </Modal>
      )}

      {detail && (
        <Modal title={`Membre — ${detail.name}`} onClose={() => setDetail(null)} labelledBy="user-detail-title">
          <div className="space-y-4" id="user-detail-title">
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Avatar name={detail.name} email={detail.email} src={userAvatarSrc(detail.avatarUrl)} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-slate-800">{detail.name}</p>
                  <p className="truncate text-sm text-slate-500">{detail.email}</p>
                  <p className="mt-1 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{roleLabel(detail.role)}</span>
                    <StatusBadge active={detail.isActive ?? detail.is_active} />
                  </p>
                </div>
                {canUpdate && detail.role === 'employee' && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <input ref={avatarInputRef} type="file" accept={ACCEPT} onChange={(e) => onAvatarSelect(e, detail.id)} className="sr-only" aria-label="Choisir une photo pour cet employé (JPG, PNG ou WEBP, 5 Mo maximum)" />
                    <Button size="sm" variant="outline" onClick={pickAvatar} loading={uploadingAvatar} icon={<Camera size={15} aria-hidden="true" />}>
                      Photo
                    </Button>
                    {detail.avatarUrl && (
                      <Button size="sm" variant="dangerOutline" onClick={() => removeAvatar(detail.id)} loading={uploadingAvatar} icon={<Trash2 size={15} aria-hidden="true" />}>
                        Retirer
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {avatarError && <p className="mt-2 text-sm text-red-600" role="alert">{avatarError}</p>}
            </Card>

            <Card>
              <CardTitle action={<Pencil size={16} aria-hidden="true" className="text-slate-400" />}>
                Informations
              </CardTitle>
              {!editing ? (
                <>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Email</dt><dd className="break-words font-semibold">{detail.email}</dd></div>
                    <div><dt className="text-xs text-slate-500">Membre depuis</dt><dd className="font-semibold">{formatDateTime(detail.createdAt)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Dernière connexion</dt><dd className="font-semibold">{detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : 'Jamais connecté'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Dernière activité</dt><dd className="font-semibold">{detail.lastActivityAt ? formatDateTime(detail.lastActivityAt) : 'Aucune activité enregistrée'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Sessions actives</dt><dd className="font-semibold">{detail.sessionsCount ?? sessions.length}</dd></div>
                  </dl>
                  {canUpdate && detail.role === 'employee' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditError(''); setEditing(true); }} icon={<Pencil size={15} aria-hidden="true" />}>
                        Modifier
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={submitEdit} className="space-y-3">
                  <Field label="Nom" required>
                    <TextInput value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} maxLength={255} aria-label="Nom du membre" />
                  </Field>
                  <Field label="Email" required>
                    <TextInput type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} maxLength={255} aria-label="Email du membre" />
                  </Field>
                  {editError && <p className="text-sm text-red-600" role="alert">{editError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" type="submit" loading={savingEdit}>Enregistrer</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Annuler</Button>
                  </div>
                </form>
              )}
            </Card>

            <Card>
              <CardTitle action={<ShieldCheck size={16} aria-hidden="true" className="text-slate-400" />}>
                Permissions
              </CardTitle>
              {detail.role !== 'employee' ? (
                <p className="text-sm text-slate-600">Administrateur : toutes les permissions sont accordées implicitement (aucune affectation en base).</p>
              ) : !canManageRoles ? (
                <ul className="flex flex-wrap gap-1.5">
                  {(detail.permissions || perms).map((c) => (
                    <li key={c} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{c}</li>
                  ))}
                  {(detail.permissions || perms).length === 0 && <li className="text-sm text-slate-500">Aucune permission explicite.</li>}
                </ul>
              ) : (
                <>
                  {permsLoading ? <Loading /> : (
                    <PermissionsEditor value={perms} onChange={setPerms} disabled={savingPerms} />
                  )}
                  {permsError && <p className="mt-2 text-sm text-red-600" role="alert">{permsError}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={submitPerms} loading={savingPerms}>Enregistrer les permissions</Button>
                    <Button size="sm" variant="ghost" onClick={() => refreshPerms(detail.id)}>Recharger</Button>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <CardTitle action={<MonitorSmartphone size={16} aria-hidden="true" className="text-slate-400" />}>
                Sécurité
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {canUpdate && !isSelfDetail && (
                  <>
                    <Button size="sm" variant={(detail.isActive ?? detail.is_active) ? 'dangerOutline' : 'outline'} onClick={() => toggleStatus(detail)} loading={toggling}>
                      {(detail.isActive ?? detail.is_active) ? 'Désactiver' : 'Réactiver'}
                    </Button>
                    {detail.role === 'employee' && (
                      <Button size="sm" variant="outline" onClick={() => { setPwError(''); setPwForm({ next: '', confirm: '' }); setPwTarget(detail); }} icon={<KeyRound size={15} aria-hidden="true" />}>
                        Réinitialiser le mot de passe
                      </Button>
                    )}
                  </>
                )}
                {isSelfDetail && <p className="text-sm text-slate-500">Votre propre compte : utilisez la page Profil pour le mot de passe et les sessions.</p>}
              </div>
              {detail.role === 'employee' && canUpdate && !isSelfDetail && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Sessions actives ({sessions.length})</p>
                  {sessionsLoading ? <Loading /> : sessions.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune session active.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      {sessions.map((s) => (
                        <li key={s.id} className="truncate">
                          {s.userAgent || 'Appareil inconnu'} · connectée le {formatDateTime(s.createdAt)}{s.ipAddress ? ` · ${s.ipAddress}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {sessions.length > 0 && (
                    <div className="mt-2">
                      <Button size="sm" variant="dangerOutline" onClick={() => revokeAll(detail.id)} loading={revokingSessions}>
                        Révoquer toutes les sessions
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </Modal>
      )}

      {pwTarget && (
        <Modal title={`Réinitialiser le mot de passe — ${pwTarget.email}`} onClose={() => setPwTarget(null)}>
          <form onSubmit={submitPassword} className="space-y-3">
            <p className="text-sm text-slate-600">
              Le nouveau mot de passe est hashé immédiatement. Les sessions existantes de l'employé seront révoquées : il devra se reconnecter.
            </p>
            <Field label="Nouveau mot de passe" required>
              <TextInput type="password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} maxLength={128} autoComplete="new-password" aria-label="Nouveau mot de passe" />
            </Field>
            <Field label="Confirmation" required>
              <TextInput type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} maxLength={128} autoComplete="new-password" aria-label="Confirmer le nouveau mot de passe" />
            </Field>
            <p className="text-xs text-slate-500">8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.</p>
            {pwError && <p className="text-sm text-red-600" role="alert">{pwError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={savingPw}>Réinitialiser</Button>
              <Button type="button" variant="ghost" onClick={() => setPwTarget(null)}>Annuler</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
