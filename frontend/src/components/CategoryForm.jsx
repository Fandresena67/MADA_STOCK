import { useState } from 'react';
import { Field, TextInput, PrimaryButton } from './ui';

export function CategoryForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '' });
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handle(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Opération impossible');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <Field label="Nom de la catégorie">
        <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
      </Field>
      <Field label="Description (optionnel)">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
    </form>
  );
}
