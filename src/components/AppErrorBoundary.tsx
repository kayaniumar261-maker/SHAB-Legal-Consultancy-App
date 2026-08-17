import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, House, RefreshCw } from 'lucide-react';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean; reference: string };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, reference: '' };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
      reference: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
    };
  }

  componentDidCatch(error: Error, information: ErrorInfo) {
    console.error('SHAB application error', error, information.componentStack);
  }

  private returnToDashboard = () => {
    if (window.location.protocol === 'file:') {
      window.location.hash = '#/';
      window.location.reload();
      return;
    }

    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-screen" role="alert">
        <section className="app-error-card">
          <div className="app-error-icon"><AlertTriangle size={30} /></div>
          <p className="app-error-eyebrow">SHAB Legal Consultants FZC</p>
          <h1>We could not display this page.</h1>
          <p>Your work and Supabase data remain protected. Reload the application or return safely to the Dashboard.</p>
          <div className="app-error-actions">
            <button type="button" className="app-error-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={18} /> Reload application
            </button>
            <button type="button" className="app-error-secondary" onClick={this.returnToDashboard}>
              <House size={18} /> Return to Dashboard
            </button>
          </div>
          <small>Error reference: {this.state.reference}</small>
        </section>
      </main>
    );
  }
}
