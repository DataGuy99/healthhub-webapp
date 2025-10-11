import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-8 max-w-lg">
            <div className="text-red-300">
              <div className="text-4xl mb-4 text-center">⚠️</div>
              <h2 className="text-2xl font-bold mb-4 text-center">Something went wrong</h2>
              <div className="bg-black/20 p-4 rounded-lg mb-4">
                <pre className="text-xs overflow-auto">
                  {this.state.error?.message}
                </pre>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg font-semibold transition-all"
              >
                Reload Page
              </button>
              <div className="mt-4 text-sm text-center text-red-200/70">
                If this persists, check browser console for details
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
