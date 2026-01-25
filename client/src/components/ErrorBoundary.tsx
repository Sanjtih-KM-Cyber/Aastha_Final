import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
        <div className="fixed inset-0 z-[9999] bg-[#0a0e17] flex flex-col items-center justify-center p-6 text-center text-white font-sans">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <AlertTriangle size={40} className="text-red-500" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-white/60 mb-8 max-w-xs mx-auto">
            Aastha encountered an unexpected issue.
          </p>

          <div className="p-4 bg-white/5 border border-white/10 rounded-xl mb-8 w-full max-w-sm overflow-hidden text-left">
            <p className="text-xs font-mono text-red-300 break-words">
              {this.state.error?.toString()}
            </p>
            {this.state.errorInfo && (
                <details className="mt-2">
                    <summary className="text-[10px] text-white/30 cursor-pointer">Stack Trace</summary>
                    <pre className="text-[10px] text-white/30 mt-2 overflow-x-auto whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                    </pre>
                </details>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              <RefreshCw size={18} />
              Reload App
            </button>

            <button
              onClick={this.handleClearCache}
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 text-white/70 font-medium rounded-xl hover:bg-white/10 transition-colors"
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
