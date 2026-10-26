"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
          <div className="rounded-2xl border border-danger-100 bg-danger-50/50 p-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-danger-100">
              <AlertTriangle className="size-6 text-danger-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Terjadi Kesalahan</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message || "Terjadi kesalahan yang tidak terduga."}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="size-3.5" />
              Coba Lagi
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
