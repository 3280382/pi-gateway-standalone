/**
 * Main Entry Point
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

// 全局错误处理 - 捕获未处理的错误
window.onerror = (message, source, lineno, colno, error) => {
	console.error("[Global Error]", {
		message,
		source,
		lineno,
		colno,
		error: error?.stack || error,
	});
	// 显示明显的错误提示
	const errorDiv = document.createElement("div");
	errorDiv.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: #ff4444;
		color: white;
		padding: 16px;
		font-family: monospace;
		font-size: 14px;
		z-index: 99999;
	`;
	errorDiv.innerHTML = `<strong>Global Error:</strong> ${message}<br><small>${source}:${lineno}</small>`;
	document.body.appendChild(errorDiv);
	return false; // 让错误继续冒泡
};

// 捕获未处理的 Promise 错误
window.addEventListener("unhandledrejection", (event) => {
	console.error("[Unhandled Promise Rejection]", event.reason);
	const errorDiv = document.createElement("div");
	errorDiv.style.cssText = `
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #ff8800;
		color: white;
		padding: 16px;
		font-family: monospace;
		font-size: 14px;
		z-index: 99999;
	`;
	errorDiv.innerHTML = `<strong>Promise Error:</strong> ${event.reason}`;
	document.body.appendChild(errorDiv);
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
