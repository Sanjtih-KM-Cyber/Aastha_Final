import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { reportError } from '../monitoring';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    reportError(error, { boundary: "app" });
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-md-surface flex flex-col items-center justify-center p-6 text-center text-md-on-surface font-sans">
          <div className="w-20 h-20 bg-md-error-container text-md-on-error-container rounded-[28px] flex items-center justify-center mb-6">
            <AlertTriangle size={36} />
          </div>

          <h1 className="font-serif text-3xl mb-2">Something went wrong</h1>
          <p className="text-md-on-surface-variant mb-8 max-w-xs mx-auto">
            Aastha encountered an unexpected issue.
          </p>

          <div className="p-4 bg-md-surface-container border border-md-outline-variant/40 rounded-[20px] mb-8 w-full max-w-sm overflow-hidden text-left">
            <p className="text-xs font-mono text-md-error break-words">
              {this.state.error?.toString()}
            </p>
            {this.state.errorInfo && (
                <details className="mt-2">
                    <summary className="text-[10px] text-md-on-surface-variant/70 cursor-pointer">Stack Trace</summary>
                    <pre className="text-[10px] text-md-on-surface-variant/70 mt-2 overflow-x-auto whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                    </pre>
                </details>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full h-12 bg-md-primary text-md-on-primary font-semibold rounded-full hover:brightness-110 transition"
            >
              <RefreshCw size={18} />
              Reload App
            </button>

            <button
              onClick={this.handleClearCache}
              className="flex items-center justify-center gap-2 w-full h-12 bg-md-secondary-container text-md-on-secondary-container font-medium rounded-full hover:brightness-110 transition"
            >
              <Home size={18} />
              Reset & Logout
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
