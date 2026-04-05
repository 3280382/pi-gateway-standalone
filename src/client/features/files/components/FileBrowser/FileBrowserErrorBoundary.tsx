import React, { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * File Browser Error Boundary
 * Specialized error boundary for file browser components
 */
interface Props {
	children: ReactNode;
	componentName?: string;
	onError?: (error: Error, componentName?: string) => void;
}
interface State {
	hasError: boolean;
	error: Error | null;
}
export class FileBrowserErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
		};
	}
	static getDerivedStateFromError(error: Error): State {
		return {
			hasError: true,
			error,
		};
	}
	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error(
			`FileBrowserErrorBoundary caught error in ${this.props.componentName || "unknown component"}:`,
			error,
			errorInfo,
		);

		// Call the onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, this.props.componentName);
		}
		// You could also send to error tracking service here
		// trackError(error, { component: this.props.componentName, ...errorInfo });
	}
	handleRetry = (): void => {
		this.setState({
			hasError: false,
			error: null,
		});
	};
	render(): ReactNode {
		if (this.state.hasError) {
			const componentName = this.props.componentName || "File Browser";

			return (
				<div className="file-browser-error">
					<div className="error-icon">
						<svg
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						>
							<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h3>{componentName} Error</h3>
					<p className="error-message">
						{this.state.error?.message ||
							"An error occurred while loading this component"}
					</p>
					<div className="error-suggestions">
						<p>This might be caused by:</p>
						<ul>
							<li>Network connectivity issues</li>
							<li>File permission problems</li>
							<li>Corrupted file data</li>
							<li>Browser compatibility issues</li>
						</ul>
					</div>
					<div className="error-actions">
						<button className="retry-btn" onClick={this.handleRetry}>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
							</svg>
							Retry
						</button>
						<button
							className="refresh-btn"
							onClick={() => window.location.reload()}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3" />
							</svg>
							Refresh Page
						</button>
					</div>
					<style>{`
            .file-browser-error {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 32px 24px;
              background: var(--bg-secondary);
              border: 1px solid var(--border-subtle);
              border-radius: 8px;
              margin: 16px;
              text-align: center;
            }
            
            .error-icon {
              color: var(--accent-orange);
              margin-bottom: 16px;
            }
            
            .file-browser-error h3 {
              color: var(--text-primary);
              margin-bottom: 12px;
              font-size: 16px;
              font-weight: 600;
            }
            
            .error-message {
              color: var(--text-secondary);
              font-size: 14px;
              margin-bottom: 20px;
              max-width: 400px;
              line-height: 1.5;
            }
            
            .error-suggestions {
              background: var(--bg-tertiary);
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 24px;
              text-align: left;
              max-width: 400px;
            }
            
            .error-suggestions p {
              color: var(--text-primary);
              margin-bottom: 8px;
              font-size: 13px;
              font-weight: 500;
            }
            
            .error-suggestions ul {
              color: var(--text-muted);
              font-size: 12px;
              padding-left: 20px;
              margin: 0;
            }
            
            .error-suggestions li {
              margin-bottom: 4px;
              line-height: 1.4;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
            }
            
            .retry-btn,
            .refresh-btn {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 16px;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.15s;
              border: 1px solid var(--border-subtle);
            }
            
            .retry-btn {
              background: var(--accent-blue);
              color: white;
              border-color: var(--accent-blue);
            }
            
            .retry-btn:hover {
              background: var(--accent-blue-dark);
            }
            
            .refresh-btn {
              background: var(--bg-tertiary);
              color: var(--text-primary);
            }
            
            .refresh-btn:hover {
              background: var(--bg-hover);
            }
            
            .retry-btn svg,
            .refresh-btn svg {
              flex-shrink: 0;
            }
          `}</style>
				</div>
			);
		}
		return this.props.children;
	}
}
/**
 * Wrapper components for specific file browser components
 */
export const FileBrowserWithErrorBoundary: React.FC<{
	children: ReactNode;
}> = ({ children }) => (
	<FileBrowserErrorBoundary componentName="File Browser">
		{children}
	</FileBrowserErrorBoundary>
);
export const FileViewerWithErrorBoundary: React.FC<{ children: ReactNode }> = ({
	children,
}) => (
	<FileBrowserErrorBoundary componentName="File Viewer">
		{children}
	</FileBrowserErrorBoundary>
);
export const FileSidebarWithErrorBoundary: React.FC<{
	children: ReactNode;
}> = ({ children }) => (
	<FileBrowserErrorBoundary componentName="File Sidebar">
		{children}
	</FileBrowserErrorBoundary>
);
/**
 * Hook for file browser specific error handling
 */
export function useFileBrowserErrorHandler() {
	const [error, setError] = React.useState<Error | null>(null);
	const [errorContext, setErrorContext] = React.useState<string>("");
	const handleError = React.useCallback((err: Error, context?: string) => {
		console.error(`File browser error${context ? ` in ${context}` : ""}:`, err);
		setError(err);
		setErrorContext(context || "");
	}, []);
	const clearError = React.useCallback(() => {
		setError(null);
		setErrorContext("");
	}, []);
	const getErrorMessage = React.useCallback(() => {
		if (!error) return "";

		const baseMessage = error.message;
		const contextMessage = errorContext ? ` (${errorContext})` : "";

		return `${baseMessage}${contextMessage}`;
	}, [error, errorContext]);
	return {
		error,
		errorContext,
		errorMessage: getErrorMessage(),
		handleError,
		clearError,
	};
}
