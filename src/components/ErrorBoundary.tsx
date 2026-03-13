import React from 'react';
import { AlertTriangle, Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createDebugBundle,
  copyDebugBundleToClipboard,
  downloadDebugBundle,
  getDebugInstructions,
  type DebugBundle,
} from '@/lib/debugBundle';
import { capture } from '@/lib/analytics';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  debugBundle: DebugBundle | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      debugBundle: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Create debug bundle with error context
    const bundle = createDebugBundle(error, {
      component_stack: errorInfo.componentStack,
    });

    this.setState({ debugBundle: bundle });

    // PostHog: capture error_encountered for funnel error visibility
    capture('error_encountered', {
      flow: 'app_error_boundary',
      failure_reason: error.message,
      error_code: error.name,
    });
  }

  handleCopyDebugBundle = async () => {
    if (!this.state.debugBundle) return;

    const success = await copyDebugBundleToClipboard(this.state.debugBundle);

    if (success) {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    }
  };

  handleDownloadDebugBundle = () => {
    if (!this.state.debugBundle) return;
    downloadDebugBundle(this.state.debugBundle);
  };

  render() {
    if (this.state.hasError) {
      const { error, debugBundle, copied } = this.state;
      const instructions = debugBundle ? getDebugInstructions(debugBundle) : '';

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            We're sorry for the inconvenience. The error has been logged and our team will investigate.
          </p>

          {error && (
            <div className="bg-muted/50 rounded-md p-4 mb-6 max-w-2xl">
              <p className="text-sm font-mono text-left text-red-600 dark:text-red-400">
                {error.message}
              </p>
            </div>
          )}

          {debugBundle && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 max-w-2xl">
              <h3 className="font-semibold text-sm mb-2 text-left">Debug Information</h3>
              <pre className="text-xs text-left whitespace-pre-wrap text-muted-foreground font-mono mb-4">
                {instructions}
              </pre>

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={this.handleCopyDebugBundle}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={copied}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Debug Bundle
                    </>
                  )}
                </Button>

                <Button
                  onClick={this.handleDownloadDebugBundle}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3 text-center">
                Share this debug bundle with support for faster resolution
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()} variant="default">
              Refresh Page
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
            >
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
