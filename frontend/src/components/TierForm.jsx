import { useState } from 'react';
import { Field, TextInput, PrimaryButton } from './ui';

export function TierForm({ initial, onSubmit, submitting, labels }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    address: initial?.address || '',
    notes: initial?.notes || '',
  });
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handle(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ ...form, name: form.name.trim() });
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => d.message).join(' — ');
      setError(details || err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label={labels?.name || 'Nom *'}>
        <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email">
          <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={255} />
        </Field>
        <Field label="Téléphone">
          <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={64} />
        </Field>
      </div>
      <Field label="Adresse">
        <TextInput value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={500} />
      </Field>
      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
    </form>
  );
}
