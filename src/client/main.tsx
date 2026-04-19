/**
 * Main Entry Point
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

// Global error handling - 捕获未处理的错误
let errorDiv: HTMLDivElement | null = null;

function showErrorBanner(message: string, type: "error" | "promise" = "error") {
  // If error indicator exists, remove it first
  if (errorDiv?.parentNode) {
    errorDiv.parentNode.removeChild(errorDiv);
  }

  const isError = type === "error";
  errorDiv = document.createElement("div");
  errorDiv.style.cssText = `
		position: fixed;
		${isError ? "top: 0" : "bottom: 0"};
		left: 0;
		right: 0;
		background: ${isError ? "#ff4444" : "#ff8800"};
		color: white;
		padding: 16px;
		font-family: monospace;
		font-size: 14px;
		z-index: 99999;
		cursor: pointer;
	`;
  errorDiv.innerHTML = `<strong>${isError ? "Global Error" : "Promise Error"}:</strong> ${message}<br><small>Click to dismiss</small>`;

  // Click to close
  errorDiv.onclick = () => {
    if (errorDiv?.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
      errorDiv = null;
    }
  };

  document.body.appendChild(errorDiv);
}

window.onerror = (message, source, lineno, colno, error) => {
  console.error("[Global Error]", { message, source, lineno, colno, error });
  showErrorBanner(`${message} (${source}:${lineno})`, "error");
  return false;
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  showErrorBanner(String(event.reason), "promise");
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// Modified for git test
// Another test for git status
