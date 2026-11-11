"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
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
        <div className="flex min-h-[400px] flex-col items-center justify-center bg-muted p-6">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mb-4 flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-danger-soft">
              <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Terjadi Kesalahan</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Halaman gagal dimuat. Coba lagi, atau muat ulang aplikasi bila masalah berlanjut.
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
