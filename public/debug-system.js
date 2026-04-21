/**
 * Mobile Debug System - Eruda Integration
 * Controlled by localStorage DEBUG_ERUDA
 * - null/not set: load eruda (default enabled)
 * - "true": load eruda
 * - "force": do NOT load eruda (force disabled)
 */

(() => {
  // Check localStorage first
  var shouldLoad = true;

  try {
    const value = localStorage.getItem("DEBUG_ERUDA");
    // Only disable if explicitly set to "force"
    if (value === "force") {
      shouldLoad = false;
    }
    // null, "true", or any other value → load eruda
  } catch (_e) {
    // Error reading localStorage → load eruda (safe default)
    shouldLoad = true;
  }

  // Exit early if disabled
  if (!shouldLoad) {
    console.log("[DebugSystem] Eruda disabled by user");
    return;
  }

  // Mark as enabled
  window.__DEBUG_ENABLED__ = true;

  // Early console capture
  var earlyLogs = [];
  var originalLog = console.log;
  var originalError = console.error;
  var originalWarn = console.warn;

  var captureLog = (type, args) => {
    earlyLogs.push({
      time: new Date().toISOString(),
      type: type,
      message: Array.prototype.slice
        .call(args)
        .map((arg) => {
          try {
            return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" "),
    });
    if (earlyLogs.length > 1000) earlyLogs.shift();
  };

  console.log = (...args) => {
    captureLog("log", args);
    originalLog.apply(console, args);
  };
  console.error = (...args) => {
    captureLog("error", args);
    originalError.apply(console, args);
  };
  console.warn = (...args) => {
    captureLog("warn", args);
    originalWarn.apply(console, args);
  };

  // Load eruda
  var initEruda = () => {
    if (typeof eruda !== "undefined") {
      startEruda();
      return;
    }

    var script = document.createElement("script");
    script.src = "/eruda.min.js";
    script.async = false;

    script.onload = () => {
      if (typeof eruda !== "undefined") {
        startEruda();
      }
    };

    script.onerror = () => {
      console.error("[DebugSystem] Failed to load eruda");
    };

    document.head.appendChild(script);
  };

  var startEruda = () => {
    try {
      eruda.init({
        tool: ["console", "network", "elements", "resources", "info"],
        useShadowDom: true,
        autoScale: true,
      });

      // Hide panel, show button only
      eruda.hide();

      // Replay early logs
      if (earlyLogs.length > 0) {
        earlyLogs.forEach((entry) => {
          var time = new Date(entry.time).toLocaleTimeString();
          var msg = `[Early ${entry.type.toUpperCase()} ${time}] ${entry.message}`;
          eruda.get("console").log(msg);
        });
      }

      window.DebugSystem = {
        show: () => {
          eruda.show();
        },
        hide: () => {
          eruda.hide();
        },
      };
    } catch (e) {
      console.error("[DebugSystem] Failed to init eruda:", e);
    }
  };

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEruda);
  } else {
    initEruda();
  }
})();
