/**
 * Mobile Debug System - Eruda Integration
 * Controlled by localStorage DEBUG_ERUDA
 * - null/not set: load eruda (default enabled)
 * - "true": load eruda
 * - "force": do NOT load eruda (force disabled)
 */

(function() {
  // Check localStorage first
  var shouldLoad = true;
  
  try {
    var value = localStorage.getItem("DEBUG_ERUDA");
    // Only disable if explicitly set to "force"
    if (value === "force") {
      shouldLoad = false;
    }
    // null, "true", or any other value → load eruda
  } catch (e) {
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

  function captureLog(type, args) {
    earlyLogs.push({
      time: new Date().toISOString(),
      type: type,
      message: Array.prototype.slice.call(args).map(function(arg) {
        try {
          return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
        } catch {
          return String(arg);
        }
      }).join(" ")
    });
    if (earlyLogs.length > 1000) earlyLogs.shift();
  }

  console.log = function() {
    captureLog("log", arguments);
    originalLog.apply(console, arguments);
  };
  console.error = function() {
    captureLog("error", arguments);
    originalError.apply(console, arguments);
  };
  console.warn = function() {
    captureLog("warn", arguments);
    originalWarn.apply(console, arguments);
  };

  // Load eruda
  function initEruda() {
    if (typeof eruda !== "undefined") {
      startEruda();
      return;
    }

    var script = document.createElement("script");
    script.src = "/eruda.min.js";
    script.async = false;

    script.onload = function() {
      if (typeof eruda !== "undefined") {
        startEruda();
      }
    };

    script.onerror = function() {
      console.error("[DebugSystem] Failed to load eruda");
    };

    document.head.appendChild(script);
  }

  function startEruda() {
    try {
      eruda.init({
        tool: ["console", "network", "elements", "resources", "info"],
        useShadowDom: true,
        autoScale: true
      });

      // Hide panel, show button only
      eruda.hide();

      // Replay early logs
      if (earlyLogs.length > 0) {
        earlyLogs.forEach(function(entry) {
          var time = new Date(entry.time).toLocaleTimeString();
          var msg = "[Early " + entry.type.toUpperCase() + " " + time + "] " + entry.message;
          eruda.get("console").log(msg);
        });
      }

      window.DebugSystem = {
        show: function() { eruda.show(); },
        hide: function() { eruda.hide(); }
      };
    } catch (e) {
      console.error("[DebugSystem] Failed to init eruda:", e);
    }
  }

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEruda);
  } else {
    initEruda();
  }
})();
