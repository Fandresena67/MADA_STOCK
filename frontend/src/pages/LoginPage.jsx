import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { setAccessToken } from '../api/client';
import { AuthCard, Field, TextInput, PrimaryButton } from '../components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form);
      // Refresh token en cookie HttpOnly (plus de stockage JS). Access en local.
      setAccessToken(result.accessToken);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Connexion" subtitle="Accédez à votre espace entreprise">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <TextInput
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="vous@entreprise.mg"
          />
        </Field>
        <Field label="Mot de passe">
          <TextInput
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <PrimaryButton disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</PrimaryButton>
      </form>
      <p className="text-sm text-slate-600">
        Pas de compte ?{' '}
        <Link to="/register" className="font-semibold text-primary-600 hover:underline">
          Créer mon entreprise
        </Link>
      </p>
    </AuthCard>
  );
}
