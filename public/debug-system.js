/**
 * Mobile Debug System - Eruda Integration
 * Features:
 * 1. Auto-enable on mobile devices
 * 2. Auto-enable on localhost/127.0.0.1
 * 3. Force enable with ?debug=true
 * 4. LocalStorage DEBUG switch
 * 5. Error capture
 * 6. Lazy loading for performance
 */

(() => {
	// Configuration
	const CONFIG = {
		erudaVersion: "3.0.1",
		localStorageKey: "DEBUG_ERUDA",
		urlParam: "debug",
		mobileBreakpoint: 768,
		localhostPatterns: ["localhost", "127.0.0.1", "::1", "0.0.0.0"],
	};

	// Debug state
	let isDebugEnabled = false;
	let erudaLoaded = false;

	/**
	 * Check if should enable debug mode
	 */
	function shouldEnableDebug() {
		const url = new URL(window.location.href);

		// 1. URL parameter ?debug=true
		if (url.searchParams.get(CONFIG.urlParam) === "true") {
			return { enabled: true, reason: "url_param" };
		}

		// 2. LocalStorage switch
		try {
			if (localStorage.getItem(CONFIG.localStorageKey) === "true") {
				return { enabled: true, reason: "localStorage" };
			}
		} catch (e) {
			// localStorage not available
		}

		// 3. Auto-enable on localhost/127.0.0.1
		const hostname = window.location.hostname;
		if (
			CONFIG.localhostPatterns.some((pattern) => hostname.includes(pattern))
		) {
			return { enabled: true, reason: "localhost" };
		}

		// 4. Auto-enable on mobile devices
		const isMobile =
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
				navigator.userAgent,
			);
		if (isMobile) {
			return { enabled: true, reason: "mobile_device" };
		}

		// 5. Auto-enable on small screens
		if (window.innerWidth < CONFIG.mobileBreakpoint) {
			return { enabled: true, reason: "small_screen" };
		}

		return { enabled: false, reason: "none" };
	}

	/**
	 * Load eruda dynamically
	 */
	function loadEruda() {
		if (erudaLoaded) return Promise.resolve();

		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = `https://cdn.jsdelivr.net/npm/eruda@${CONFIG.erudaVersion}/eruda.min.js`;
			script.async = true;

			script.onload = () => {
				if (typeof eruda !== "undefined") {
					eruda.init({
						tool: ["console", "network", "elements", "resources", "info"],
						useShadowDom: true,
						autoScale: true,
					});
					erudaLoaded = true;
					resolve();
				} else {
					reject(new Error("Eruda failed to load"));
				}
			};

			script.onerror = () => {
				reject(new Error("Failed to load eruda script"));
			};

			document.head.appendChild(script);
		});
	}

	/**
	 * Create fallback console UI (when eruda fails)
	 */
	function createFallbackConsole() {
		const div = document.createElement("div");
		div.id = "mobile-debug-console";
		div.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: #1a1a2e;
      color: #e6edf3;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      overflow-y: auto;
      border-top: 2px solid #58a6ff;
    `;

		const header = document.createElement("div");
		header.style.cssText = `
      padding: 8px;
      background: #16213e;
      border-bottom: 1px solid #30363d;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
		header.innerHTML =
			'<span>📱 Debug Console</span><button id="debug-close" style="background:none;border:none;color:#fff;cursor:pointer;">✕</button>';

		const content = document.createElement("div");
		content.id = "debug-content";
		content.style.padding = "8px";

		div.appendChild(header);
		div.appendChild(content);
		document.body.appendChild(div);

		document.getElementById("debug-close").onclick = () => div.remove();

		return {
			log: (msg, type = "info") => {
				const line = document.createElement("div");
				line.style.cssText = `margin: 2px 0; padding: 2px; border-left: 3px solid ${type === "error" ? "#f85149" : type === "warn" ? "#d29922" : "#58a6ff"}; padding-left: 6px;`;
				line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
				content.appendChild(line);
				content.scrollTop = content.scrollHeight;
			},
		};
	}

	/**
	 * Setup error capturing
	 */
	function setupErrorCapture() {
		const logs = [];

		function addLog(type, message, detail) {
			const entry = {
				time: new Date().toISOString(),
				type,
				message,
				detail,
			};
			logs.push(entry);

			// Also log to console
			console.log(`[Debug:${type}]`, message, detail || "");

			// Save to localStorage for persistence
			try {
				localStorage.setItem("DEBUG_LOGS", JSON.stringify(logs.slice(-50)));
			} catch (e) {}
		}

		// Capture window errors
		const originalOnError = window.onerror;
		window.onerror = function (msg, url, line, col, error) {
			addLog("error", msg, { url, line, col, stack: error?.stack });
			if (originalOnError) return originalOnError.apply(this, arguments);
			return false;
		};

		// Capture unhandled promise rejections
		window.addEventListener("unhandledrejection", (e) => {
			addLog("promise_error", String(e.reason), { reason: e.reason });
		});

		// Capture console errors
		const originalError = console.error;
		console.error = (...args) => {
			addLog("console_error", args.map(String).join(" "));
			originalError.apply(console, args);
		};

		// Capture console warnings
		const originalWarn = console.warn;
		console.warn = (...args) => {
			addLog("warn", args.map(String).join(" "));
			originalWarn.apply(console, args);
		};

		return logs;
	}

	/**
	 * Create debug toggle button
	 */
	function createToggleButton() {
		const btn = document.createElement("button");
		btn.id = "debug-toggle";
		btn.textContent = "🐛";
		btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #58a6ff;
      border: none;
      color: white;
      font-size: 20px;
      z-index: 999998;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

		btn.onclick = () => {
			if (erudaLoaded && typeof eruda !== "undefined") {
				eruda.show();
			} else {
				loadEruda().then(() => eruda.show());
			}
		};

		document.body.appendChild(btn);
	}

	/**
	 * Initialize debug system
	 */
	function init() {
		const debugCheck = shouldEnableDebug();

		if (!debugCheck.enabled) {
			console.log("[DebugSystem] Debug mode disabled");
			return;
		}

		console.log(
			"[DebugSystem] Enabling debug mode, reason:",
			debugCheck.reason,
		);
		isDebugEnabled = true;

		// Setup error capture immediately
		const logs = setupErrorCapture();

		// Wait for DOM ready
		function onReady() {
			// Try to load eruda
			loadEruda()
				.then(() => {
					console.log("[DebugSystem] Eruda loaded successfully");

					// Add startup logs
					eruda.get("console").log("Debug System Active");
					eruda.get("console").log("Reason: " + debugCheck.reason);
					eruda.get("console").log("UA: " + navigator.userAgent);
				})
				.catch((err) => {
					console.warn("[DebugSystem] Eruda failed, using fallback:", err);
					const fallback = createFallbackConsole();
					logs.forEach((log) => fallback.log(log.message, log.type));
				});
		}

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", onReady);
		} else {
			onReady();
		}
	}

	// Expose API
	window.DebugSystem = {
		enable: () => {
			localStorage.setItem(CONFIG.localStorageKey, "true");
			location.reload();
		},
		disable: () => {
			localStorage.removeItem(CONFIG.localStorageKey);
			location.reload();
		},
		isEnabled: () => isDebugEnabled,
		show: () => {
			if (erudaLoaded) eruda.show();
		},
		hide: () => {
			if (erudaLoaded) eruda.hide();
		},
	};

	// Auto-init
	init();
})();
