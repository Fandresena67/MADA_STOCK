import { Component } from 'react';
import { TriangleAlert, RefreshCw } from 'lucide-react';

/**
 * Barrière d'erreur React : une erreur de rendu ou un chunk lazy rejeté
 * ne doit JAMAIS produire une page blanche. Affiche un état récupérable,
 * sans stack trace ni détail technique.
 */
function isChunkError(err) {
  const msg = `${err?.message || ''} ${err?.name || ''}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module/i.test(msg);
}

export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, chunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { error, chunkError: isChunkError(error) };
  }

  componentDidCatch(error) {
    // Aide développeur uniquement (console locale), jamais affichée à l'utilisateur.
    console.error('[route-error]', error?.message || error);
  }

  handleRetry = () => {
    this.setState({ error: null, chunkError: false });
    if (this.props.onRetry) this.props.onRetry();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center" role="alert">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
          <TriangleAlert size={22} />
        </span>
        <h2 className="mt-3 text-base font-semibold text-slate-800">Impossible d'afficher cette page.</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {this.state.chunkError
            ? 'Le chargement a été interrompu (connexion ou version en cours de mise à jour). Rechargez la page.'
            : 'Une erreur inattendue est survenue. Réessayez.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {this.state.chunkError ? (
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Recharger l'application
            </button>
          ) : (
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  }
}
