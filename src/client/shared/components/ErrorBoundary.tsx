/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): State {
		// Update state so the next render will show the fallback UI
		return {
			hasError: true,
			error,
			errorInfo: null,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// You can also log the error to an error reporting service
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		this.setState({
			error,
			errorInfo,
		});

		// Call the onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}
	}

	handleReset = (): void => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render(): ReactNode {
		if (this.state.hasError) {
			// You can render any custom fallback UI
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="error-boundary">
					<div className="error-boundary-content">
						<h2>Something went wrong</h2>
						<div className="error-details">
							<p className="error-message">
								{this.state.error?.message || "An unknown error occurred"}
							</p>
							{this.state.errorInfo && (
								<details className="error-stack">
									<summary>Error details</summary>
									<pre>{this.state.errorInfo.componentStack}</pre>
								</details>
							)}
						</div>
						<div className="error-actions">
							<button className="error-reset-btn" onClick={this.handleReset}>
								Try again
							</button>
							<button
								className="error-reload-btn"
								onClick={() => window.location.reload()}
							>
								Reload page
							</button>
						</div>
					</div>
					<style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 300px;
              padding: 20px;
              background: var(--bg-primary);
              border: 1px solid var(--border-subtle);
              border-radius: 8px;
              margin: 20px;
            }
            
            .error-boundary-content {
              max-width: 600px;
              text-align: center;
            }
            
            .error-boundary h2 {
              color: var(--accent-red);
              margin-bottom: 16px;
              font-size: 18px;
            }
            
            .error-details {
              background: var(--bg-secondary);
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 20px;
              text-align: left;
            }
            
            .error-message {
              color: var(--text-primary);
              margin-bottom: 12px;
              font-size: 14px;
            }
            
            .error-stack {
              color: var(--text-muted);
              font-size: 12px;
            }
            
            .error-stack summary {
              cursor: pointer;
              margin-bottom: 8px;
              color: var(--text-secondary);
            }
            
            .error-stack pre {
              white-space: pre-wrap;
              word-break: break-all;
              background: var(--bg-tertiary);
              padding: 12px;
              border-radius: 4px;
              max-height: 200px;
              overflow: auto;
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              line-height: 1.4;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
            }
            
            .error-reset-btn,
            .error-reload-btn {
              padding: 8px 16px;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.15s;
              border: 1px solid var(--border-subtle);
            }
            
            .error-reset-btn {
              background: var(--accent-blue);
              color: white;
              border-color: var(--accent-blue);
            }
            
            .error-reset-btn:hover {
              background: var(--accent-blue-dark);
            }
            
            .error-reload-btn {
              background: var(--bg-tertiary);
              color: var(--text-primary);
            }
            
            .error-reload-btn:hover {
              background: var(--bg-hover);
            }
          `}</style>
				</div>
			);
		}

		return this.props.children;
	}
}

/**
 * Higher-order component that wraps a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	errorBoundaryProps?: Omit<Props, "children">,
): React.ComponentType<P> {
	const WrappedComponent: React.ComponentType<P> = (props: P) => (
		<ErrorBoundary {...errorBoundaryProps}>
			<Component {...props} />
		</ErrorBoundary>
	);

	// Copy display name for debugging
	WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name || "Component"})`;

	return WrappedComponent;
}

/**
 * Hook for error handling in functional components
 */
export function useErrorHandler(): {
	error: Error | null;
	handleError: (error: Error) => void;
	clearError: () => void;
} {
	const [error, setError] = React.useState<Error | null>(null);

	const handleError = React.useCallback((err: Error) => {
		console.error("Component error:", err);
		setError(err);
	}, []);

	const clearError = React.useCallback(() => {
		setError(null);
	}, []);

	return { error, handleError, clearError };
}
