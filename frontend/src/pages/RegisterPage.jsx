import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import { setAccessToken } from '../api/client';
import { AuthCard, Field, TextInput, PrimaryButton } from '../components/ui';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register(form);
      setAccessToken(result.accessToken);
      navigate('/app', { replace: true });
    } catch (err) {
      const details = err.response?.data?.details?.map((d) => `${d.field}: ${d.message}`).join(' — ');
      setError(details || err.response?.data?.error || 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Créer mon entreprise" subtitle="Un espace isolé par entreprise (monnaie : MGA)">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nom de l'entreprise">
          <TextInput required value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
        </Field>
        <Field label="Votre nom">
          <TextInput required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Mot de passe (8+ car., majuscule, minuscule, chiffre)">
          <TextInput type="password" required value={form.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        <Field label="Confirmation du mot de passe">
          <TextInput
            type="password"
            required
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <PrimaryButton disabled={loading}>{loading ? 'Création…' : 'Créer mon espace'}</PrimaryButton>
      </form>
      <p className="text-sm text-slate-600">
        Déjà inscrit ?{' '}
        <Link to="/login" className="font-semibold text-primary-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  );
}
