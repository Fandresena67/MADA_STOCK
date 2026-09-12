import { useState } from 'react';
import { Field, TextInput, PrimaryButton, Textarea } from './ui';

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
      <Field label="Nom de la catégorie" required>
        <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
      </Field>
      <Field label="Description (optionnel)">
        <Textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={500}
          rows={3}
        />
      </Field>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <PrimaryButton disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
    </form>
  );
}
