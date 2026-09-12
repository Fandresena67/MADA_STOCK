import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { PageHeader, Loading, ErrorBox } from '../components/common';
import { Field, TextInput, Textarea, PrimaryButton, Card, CardTitle, Button, CompanyLogo } from '../components/ui';
import { usePermissions } from '../hooks/usePermissions';
import { getSettings, updateSettings, uploadCompanyLogo, deleteCompanyLogo, companyLogoSrc } from '../api/admin';

const LOGO_ACCEPT = '.jpg,.jpeg,.png,.webp';

const SECTIONS = [
  { title: 'Informations générales', keys: ['name', 'trade_name'] },
  { title: 'Responsable', keys: ['owner_name', 'website'] },
  { title: 'Contact', keys: ['email', 'phone'] },
  { title: 'Adresse', keys: ['address', 'city', 'country'] },
  { title: 'Informations administratives', keys: ['tax_id', 'stat_number', 'rcs_number'] },
];

const FIELD_META = {
  name: { label: "Nom de l'entreprise", required: true },
  trade_name: { label: 'Nom commercial (affiché sur les factures)' },
  owner_name: { label: 'Titulaire / Responsable' },
  website: { label: 'Site web' },
  email: { label: 'Email', type: 'email' },
  phone: { label: 'Téléphone' },
  address: { label: 'Adresse' },
  city: { label: 'Ville' },
  country: { label: 'Pays' },
  tax_id: { label: 'NIF' },
  stat_number: { label: 'STAT' },
  rcs_number: { label: 'RCS' },
};

export default function SettingsPage() {
  const { can } = usePermissions();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setForm({
          name: s.name, trade_name: s.trade_name || '', email: s.email, phone: s.phone, address: s.address, city: s.city, country: s.country,
          owner_name: s.owner_name || '', website: s.website || '', tax_id: s.tax_id || '',
          stat_number: s.stat_number || '', rcs_number: s.rcs_number || '',
          payment_info: s.payment_info || '', payment_terms: s.payment_terms || '',
        });
      })
      .catch((err) => setError(err.response?.data?.error || 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  const editable = can('settings.update');

  async function onPickLogo(e) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file || logoBusy) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      const updated = await uploadCompanyLogo(file);
      setSettings(updated);
      setNotice('Logo mis à jour.');
    } catch (err) {
      setLogoError(err.response?.data?.error || 'Envoi impossible. Réessayez.');
    } finally {
      setLogoBusy(false);
    }
  }

  async function onRemoveLogo() {
    if (!window.confirm('Supprimer le logo de l’entreprise ?')) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      const updated = await deleteCompanyLogo();
      setSettings(updated);
      setNotice('Logo supprimé.');
    } catch (err) {
      setLogoError(err.response?.data?.error || 'Suppression impossible.');
    } finally {
      setLogoBusy(false);
    }
  }

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
      <form onSubmit={handle} className="max-w-2xl space-y-4">
        <Card>
          <CardTitle action={<ImagePlus size={18} aria-hidden="true" className="text-slate-400" />}>
            Logo de l'entreprise
          </CardTitle>
          <div className="flex items-center gap-3">
            <CompanyLogo src={companyLogoSrc(settings.logo_url)} name={settings.name} size="lg" />
            {editable && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoRef}
                  type="file"
                  accept={LOGO_ACCEPT}
                  onChange={onPickLogo}
                  className="sr-only"
                  aria-label="Choisir le logo de l’entreprise (JPG, PNG ou WEBP, 5 Mo maximum)"
                />
                <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()} loading={logoBusy} icon={<ImagePlus size={14} aria-hidden="true" />}>
                  {settings.logo_url ? 'Changer le logo' : 'Ajouter un logo'}
                </Button>
                {settings.logo_url && (
                  <Button size="sm" variant="ghost" onClick={onRemoveLogo} loading={logoBusy} icon={<Trash2 size={14} aria-hidden="true" />}>
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </div>
          {logoError && <p className="mt-2 text-sm text-red-600" role="alert">{logoError}</p>}
          <p className="mt-2 text-xs text-slate-500">JPG, PNG ou WEBP — 5 Mo maximum. Affiché sur les factures.</p>
        </Card>
        <Card>
          <CardTitle>Aperçu — en-tête de vos factures</CardTitle>
          <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <CompanyLogo src={companyLogoSrc(settings.logo_url)} name={settings.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{form.trade_name?.trim() || form.name || '—'}</p>
              {form.trade_name?.trim() && form.name && form.trade_name.trim() !== form.name.trim() && (
                <p className="truncate text-xs text-slate-500">{form.name}</p>
              )}
              {form.owner_name?.trim() && <p className="text-sm text-slate-600">Titulaire : {form.owner_name.trim()}</p>}
              {[form.address?.trim(), [form.city?.trim(), form.country?.trim()].filter(Boolean).join(' · ')].filter(Boolean).map((v) => (
                <p key={v} className="truncate text-sm text-slate-600">{v}</p>
              ))}
              {[form.phone?.trim(), form.email?.trim()].filter(Boolean).map((v) => (
                <p key={v} className="truncate text-sm text-slate-600">{v}</p>
              ))}
              {[form.tax_id?.trim() && `NIF : ${form.tax_id.trim()}`, form.stat_number?.trim() && `STAT : ${form.stat_number.trim()}`, form.rcs_number?.trim() && `RCS : ${form.rcs_number.trim()}`].filter(Boolean).map((v) => (
                <p key={v} className="truncate text-sm text-slate-600">{v}</p>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Données réelles de votre entreprise, telles qu'affichées sur vos factures.</p>
        </Card>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardTitle>{s.title}</CardTitle>
            <div className="space-y-4">
              {s.keys.map((key) => (
                <Field key={key} label={FIELD_META[key].label} required={FIELD_META[key].required}>
                  <TextInput
                    type={FIELD_META[key].type || 'text'}
                    value={form[key] || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    disabled={!editable}
                    maxLength={500}
                  />
                </Field>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <CardTitle>Devise</CardTitle>
          <Field label="Devise (verrouillée)">
            <TextInput value={`${settings.currency} — Ariary`} disabled />
          </Field>
        </Card>
        <Card>
          <CardTitle>Informations de paiement (optionnel)</CardTitle>
          <div className="space-y-4">
            <Field label="Moyens de paiement acceptés">
              <Textarea
                value={form.payment_info || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, payment_info: e.target.value }))}
                disabled={!editable}
                maxLength={1000}
                rows={2}
                placeholder="Ex : Mobile Money 034 00 000 00, virement…"
              />
            </Field>
            <Field label="Conditions de paiement">
              <TextInput
                value={form.payment_terms || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                disabled={!editable}
                maxLength={500}
                placeholder="Ex : Paiement comptant"
              />
            </Field>
          </div>
        </Card>
        {!editable && <p className="text-sm text-slate-500">Lecture seule : seul un administrateur d’entreprise peut modifier ces paramètres.</p>}
        {editable && <PrimaryButton disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>}
      </form>
    </div>
  );
}
