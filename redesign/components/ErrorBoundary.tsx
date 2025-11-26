import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <div className="bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-800">
            <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-900/50">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-200 mb-2">Oops! Something went wrong</h1>
            <p className="text-slate-500 mb-6 text-sm">
              The application encountered an unexpected error. Please try reloading.
            </p>
            
            {this.state.error && (
                <div className="bg-slate-950 p-3 rounded text-xs font-mono text-red-400 mb-6 text-left overflow-auto max-h-32 border border-slate-800">
                    {this.state.error.toString()}
                </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw size={18} className="mr-2" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}