import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class I18nErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[i18n] Translation load failed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto mt-12 max-w-md rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="mb-2 font-medium">Failed to load translations.</p>
          <p className="mb-3 text-xs">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="rounded bg-destructive px-3 py-1 text-xs text-destructive-foreground hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
