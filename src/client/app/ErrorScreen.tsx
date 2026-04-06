/**
 * ErrorScreen - 应用错误页面
 */

export function ErrorScreen({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				padding: "20px",
				background: "var(--bg-primary)",
				color: "var(--text-primary)",
			}}
		>
			<h2 style={{ color: "var(--accent-red)", marginBottom: "16px" }}>
				Error
			</h2>
			<pre
				style={{
					background: "var(--bg-secondary)",
					padding: "16px",
					borderRadius: "8px",
					maxWidth: "600px",
					overflow: "auto",
					marginBottom: "20px",
				}}
			>
				{error}
			</pre>
			<button
				onClick={onRetry}
				style={{
					padding: "10px 20px",
					background: "var(--accent-primary)",
					color: "white",
					border: "none",
					borderRadius: "6px",
					cursor: "pointer",
				}}
			>
				Retry
			</button>
		</div>
	);
}
