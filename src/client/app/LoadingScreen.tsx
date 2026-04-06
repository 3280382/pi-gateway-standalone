/**
 * LoadingScreen - 应用加载页面
 */

export function LoadingScreen() {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				background: "var(--bg-primary)",
				color: "var(--text-primary)",
			}}
		>
			<div
				style={{
					fontSize: "48px",
					fontWeight: "bold",
					background:
						"linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
					WebkitBackgroundClip: "text",
					WebkitTextFillColor: "transparent",
					marginBottom: "16px",
				}}
			>
				π
			</div>
			<div style={{ color: "var(--text-secondary)" }}>
				Initializing Pi Gateway...
			</div>
		</div>
	);
}
