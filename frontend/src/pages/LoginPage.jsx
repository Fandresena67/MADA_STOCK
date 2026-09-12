import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { login } from '../api/auth';
import { setAccessToken } from '../api/client';
import { PrimaryButton } from '../components/ui';

function authErrorMessage(err) {
  const status = err.response?.status;
  if (!err.response) return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  if (status === 401) return 'Email ou mot de passe incorrect.';
  if (status === 403) return 'Accès refusé.';
  if (status === 429) return 'Trop de tentatives. Veuillez patienter quelques instants.';
  if (status >= 500) return 'Une erreur est survenue. Veuillez réessayer.';
  return err.response?.data?.error || 'Connexion impossible. Veuillez réessayer.';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate() {
    const next = {};
    const email = form.email.trim();
    if (!email) next.email = 'Veuillez saisir votre adresse email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Veuillez saisir un email valide.';
    if (!form.password) next.password = 'Veuillez saisir votre mot de passe.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (loading || !validate()) return;
    setLoading(true);
    try {
      const result = await login({ email: form.email.trim(), password: form.password });
      // Refresh token en cookie HttpOnly (plus de stockage JS). Access en local.
      setAccessToken(result.accessToken);
      // Redirection selon le rôle ; le backend reste l'autorité des permissions.
      const role = result.user?.role;
      navigate(role === 'super_admin' ? '/superadmin/dashboard' : '/app', { replace: true });
    } catch (err) {
      setServerError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (invalid) =>
    `w-full rounded-lg border bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-100 ${
      invalid ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-primary-500'
    }`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-base font-bold text-white" aria-hidden="true">
            MS
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">Bienvenue sur MADA STOCK</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez-vous à votre espace entreprise</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <div className="relative">
              <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="votre adresse email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                className={inputClass(errors.email)}
              />
            </div>
            {errors.email && <p id="login-email-error" className="mt-1 text-sm text-red-600" role="alert">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="••••••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                className={`${inputClass(errors.password)} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <p id="login-password-error" className="mt-1 text-sm text-red-600" role="alert">{errors.password}</p>}
          </div>
          {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p>}
          <PrimaryButton disabled={loading} aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Connexion…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <LogIn size={16} aria-hidden="true" />
                Se connecter
              </span>
            )}
          </PrimaryButton>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Pas de compte ?{' '}
          <Link to="/register" className="rounded font-semibold text-primary-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-500">
            Créer mon entreprise
          </Link>
        </p>
      </div>
    </div>
  );
}
