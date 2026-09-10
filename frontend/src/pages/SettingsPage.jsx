import { useEffect, useState } from 'react';
import { PageHeader, Loading, ErrorBox } from '../components/common';
import { Field, TextInput, PrimaryButton } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { getSettings, updateSettings } from '../api/admin';

const FIELDS = [
  { key: 'name', label: "Nom de l'entreprise *" },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'address', label: 'Adresse' },
  { key: 'city', label: 'Ville' },
  { key: 'country', label: 'Pays' },
];

export default function SettingsPage() {
  const { can } = usePermissions();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setForm({ name: s.name, email: s.email, phone: s.phone, address: s.address, city: s.city, country: s.country });
      })
      .catch((err) => setError(err.response?.data?.error || 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  const editable = can('settings.update');

  async function handle(e) {
    e.preventDefault();
    setNotice('');
    setSaving(true);
    try {
      const updated = await updateSettings(form);
      setSettings(updated);
      setNotice('Paramètres enregistrés.');
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setNotice('');
      alert(details || err.response?.data?.error || 'Impossible d’enregistrer les modifications.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageHeader title="Paramètres entreprise" subtitle="Informations de votre entreprise (devise : MGA / Ariary, verrouillée)" />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{notice}</p>}
      <form onSubmit={handle} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput
              type={f.type || 'text'}
              value={form[f.key] || ''}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              disabled={!editable}
              maxLength={500}
            />
          </Field>
        ))}
        <Field label="Devise (verrouillée)">
          <TextInput value={`${settings.currency} — Ariary`} disabled />
        </Field>
        {!editable && <p className="text-sm text-slate-500">Lecture seule : seul un administrateur d’entreprise peut modifier ces paramètres.</p>}
        {editable && <PrimaryButton disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>}
      </form>
    </div>
  );
}
