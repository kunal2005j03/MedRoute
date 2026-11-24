import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred while rendering MedRoute.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('MedRoute ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6">
            <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              MedRoute encountered an unexpected application error. You can reload the page to
              continue.
            </p>
            {this.state.message && (
              <pre className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {this.state.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 text-sm font-medium text-white bg-[#0F2A44] rounded-md hover:bg-[#173a5c] transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
