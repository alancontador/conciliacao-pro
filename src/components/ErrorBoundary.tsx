import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

/**
 * Top-level React Error Boundary.
 * Catches synchronous render errors that would otherwise produce a blank screen.
 * Logs fatal + renders a user-friendly fallback instead of crashing silently.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): State {
    const eventId = crypto.randomUUID();
    return { hasError: true, eventId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.fatal('render/unhandled-error', {
      error,
      data: {
        eventId: this.state.eventId,
        componentStack: info.componentStack?.split('\n').slice(0, 8).join('\n'),
      },
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, eventId: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-background text-foreground">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Recarregue a página para continuar.
          </p>
          {this.state.eventId && (
            <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
              ID: {this.state.eventId}
            </p>
          )}
        </div>
        <button
          onClick={this.handleReload}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Recarregar página
        </button>
      </div>
    );
  }
}
