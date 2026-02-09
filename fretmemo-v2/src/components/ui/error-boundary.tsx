import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors in child component tree.
 * Provides a fallback UI and recovery options.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="rounded-full bg-destructive/10 p-3">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">Something went wrong</h2>
                        <p className="text-sm text-muted-foreground max-w-md">
                            An unexpected error occurred. Try refreshing or click retry.
                        </p>
                    </div>
                    {this.state.error && (
                        <pre className="mt-2 max-w-md overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                            {this.state.error.message}
                        </pre>
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={this.handleRetry}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                        <Button onClick={this.handleReload}>Reload Page</Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
