/**
 * LogMonitorPanel - 多文件日志监控面板
 *
 * Features:
 * - 每个文件一个 xterm 窗口，高度平均分配
 * - 点击窗口头部最大化/还原
 * - 使用 WebSocket Terminal 执行 tail -f 监控文件
 * - 异步批量初始化，输出缓冲优化性能
 */

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { terminalWebSocketService } from "@/services/terminal-websocket.service";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import "@xterm/xterm/css/xterm.css";
import styles from "./LogMonitorPanel.module.css";

// ============================================================================
// Types
// ============================================================================

export interface LogMonitorConfig {
  id: string;
  name: string;
  filePaths: string[];
}

interface LogMonitorPanelProps {
  config: LogMonitorConfig;
  height: number;
  onClose: () => void;
  onHeightChange: (height: number) => void;
}

interface MonitorSession {
  sessionId: string;
  filePath: string;
  name: string;
  isReady: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function LogMonitorPanel({ config, height, onClose, onHeightChange }: LogMonitorPanelProps) {
  // ========== State ==========
  const [sessions, setSessions] = useState<MonitorSession[]>([]);
  const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ========== Refs ==========
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const terminalInstances = useRef<Map<string, Terminal>>(new Map());
  const fitAddons = useRef<Map<string, FitAddon>>(new Map());
  const isResizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);
  const unsubscribers = useRef<Array<() => void>>([]);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const outputBuffers = useRef<Map<string, string[]>>(new Map());
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPath = useWorkspaceStore((s) => s.currentPath);

  // ========== Resize Handling ==========
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      resizeStartY.current = e.clientY;
      resizeStartHeight.current = height;
      e.preventDefault();
    },
    [height]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(120, Math.min(800, resizeStartHeight.current + delta));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
    };

    if (isResizing.current) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [onHeightChange]);

  // ========== Window Resize - Fit Terminals ==========
  useEffect(() => {
    const handleWindowResize = () => {
      requestAnimationFrame(() => {
        fitAddons.current.forEach((fit, sessionId) => {
          try {
            fit.fit();
            const term = terminalInstances.current.get(sessionId);
            if (term) {
              terminalWebSocketService.resizeTerminal(sessionId, term.cols, term.rows);
            }
          } catch {
            // ignore
          }
        });
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // ========== Main Initialization ==========
  // biome-ignore lint/correctness/useExhaustiveDependencies: helper functions defined in same scope use refs only, stable mount effect
  useEffect(() => {
    if (initPromiseRef.current) return;

    const init = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);

        // 1. Connect WebSocket
        await terminalWebSocketService.connect();

        // 2. Create sessions for each file path (async batch)
        const filePaths = config.filePaths;
        const createdSessions: MonitorSession[] = [];

        // Create sessions sequentially to avoid overwhelming the server
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i];
          const sessionName = `${config.name} #${i + 1}`;

          const sessionId = await createTerminalSession(sessionName, currentPath);

          const session: MonitorSession = {
            sessionId,
            filePath,
            name: filePath.split("/").pop() || filePath,
            isReady: false,
          };
          createdSessions.push(session);
          setSessions((prev) => [...prev, session]);

          // Yield to event loop for UI responsiveness
          await yieldToEventLoop();
        }

        // 3. Setup output buffering
        setupOutputBuffering();

        // 4. Setup WebSocket listeners
        setupWebSocketListeners();

        // 5. Initialize xterm terminals (async batch with RAF)
        for (let i = 0; i < createdSessions.length; i++) {
          const session = createdSessions[i];
          await initTerminal(session.sessionId, session.filePath);
          setSessions((prev) =>
            prev.map((s) => (s.sessionId === session.sessionId ? { ...s, isReady: true } : s))
          );

          // Yield between terminals to keep UI responsive
          if (i < createdSessions.length - 1) {
            await yieldToEventLoop();
          }
        }

        setIsConnecting(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to initialize log monitor";
        setConnectionError(msg);
        setIsConnecting(false);
      }
    };

    initPromiseRef.current = init();

    return () => {
      // Cleanup on unmount
      cleanupAll();
    };
  }, [config.filePaths, config.id, config.name, currentPath]);

  // ========== Helpers ==========

  async function createTerminalSession(name: string, workingDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout creating terminal session for ${name}`));
      }, 10000);

      const unsub = terminalWebSocketService.on("terminal_created", (data: unknown) => {
        const typed = data as { sessionId: string; name: string };
        if (typed.name === name) {
          clearTimeout(timeout);
          unsub();
          resolve(typed.sessionId);
        }
      });

      terminalWebSocketService.createSession({ name, workingDir });
    });
  }

  async function initTerminal(sessionId: string, filePath: string) {
    const container = terminalRefs.current.get(sessionId);
    if (!container) {
      // Wait for container to be available
      await waitForContainer(sessionId);
    }

    const finalContainer = terminalRefs.current.get(sessionId);
    if (!finalContainer) return;

    if (finalContainer.clientWidth === 0 || finalContainer.clientHeight === 0) {
      await new Promise((r) => setTimeout(r, 100));
      return initTerminal(sessionId, filePath);
    }

    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 11,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace',
      lineHeight: 1.2,
      theme: {
        background: "#0a0c10",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
        black: "#0d1117",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#c9d1d9",
      },
      scrollback: 5000,
      allowProposedApi: true,
      convertEol: true,
      cols: 120,
      rows: 10,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(finalContainer);

    requestAnimationFrame(() => {
      try {
        fit.fit();
        const { cols, rows } = term;
        terminalWebSocketService.resizeTerminal(sessionId, cols, rows);
      } catch (e) {
        console.warn("[LogMonitor] Fit failed:", e);
      }
    });

    terminalInstances.current.set(sessionId, term);
    fitAddons.current.set(sessionId, fit);

    // Start tail command
    const escapedPath = filePath.replace(/"/g, '\\"');
    terminalWebSocketService.executeCommand(sessionId, `tail -n 100 -f "${escapedPath}"`);
  }

  function setupOutputBuffering() {
    const flushInterval = setInterval(() => {
      outputBuffers.current.forEach((buffer, sessionId) => {
        if (buffer.length === 0) return;
        const term = terminalInstances.current.get(sessionId);
        if (term) {
          const chunk = buffer.splice(0, buffer.length).join("");
          if (chunk) term.write(chunk);
        }
      });
    }, 50);

    flushIntervalRef.current = flushInterval;
  }

  function setupWebSocketListeners() {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      terminalWebSocketService.on("terminal_output", (data: unknown) => {
        const typed = data as { sessionId: string; data: string };
        const { sessionId, data: outputData } = typed;

        if (!outputBuffers.current.has(sessionId)) {
          outputBuffers.current.set(sessionId, []);
        }
        outputBuffers.current.get(sessionId)?.push(outputData);
      })
    );

    unsubs.push(
      terminalWebSocketService.on("terminal_error", (data: unknown) => {
        const typed = data as { sessionId?: string; error: string };
        if (typed.sessionId) {
          const buffer = outputBuffers.current.get(typed.sessionId);
          if (buffer) {
            buffer.push(`\r\n[Error: ${typed.error}]\r\n`);
          }
        }
      })
    );

    unsubscribers.current = unsubs;
  }

  function cleanupAll() {
    // Flush remaining output
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    outputBuffers.current.forEach((buffer, sessionId) => {
      if (buffer.length > 0) {
        const term = terminalInstances.current.get(sessionId);
        if (term) {
          term.write(buffer.join(""));
        }
      }
    });
    outputBuffers.current.clear();

    // Send Ctrl+C to stop tail processes
    sessions.forEach((s) => {
      terminalWebSocketService.executeCommand(s.sessionId, "\x03");
      // Close session after a brief delay to allow Ctrl+C to process
      setTimeout(() => {
        terminalWebSocketService.closeSession(s.sessionId, true);
      }, 300);
    });

    // Unsubscribe listeners
    for (const unsub of unsubscribers.current) {
      unsub();
    }
    unsubscribers.current = [];

    // Dispose terminals
    for (const term of terminalInstances.current.values()) {
      term.dispose();
    }
    terminalInstances.current.clear();
    fitAddons.current.clear();
    terminalRefs.current.clear();

    initPromiseRef.current = null;
  }

  async function waitForContainer(sessionId: string): Promise<void> {
    for (let i = 0; i < 50; i++) {
      if (terminalRefs.current.get(sessionId)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  function yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  // ========== Toggle Maximize ==========
  const toggleMaximize = useCallback((index: number) => {
    setMaximizedIndex((prev) => (prev === index ? null : index));
  }, []);

  // ========== Fit terminals when layout changes ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        fitAddons.current.forEach((fit, sessionId) => {
          try {
            fit.fit();
            const term = terminalInstances.current.get(sessionId);
            if (term) {
              terminalWebSocketService.resizeTerminal(sessionId, term.cols, term.rows);
            }
          } catch {
            // ignore
          }
        });
      });
    }, 100);

    return () => clearTimeout(timer);
  });

  // ========== Render ==========
  const visibleCount = sessions.filter((s) => s.isReady).length;

  return (
    <div className={styles.panel} style={{ height: `${height}px` }}>
      {/* Resize Handle */}
      <button
        type="button"
        className={styles.resizeHandle}
        aria-label="Resize panel"
        onMouseDown={handleResizeStart}
        tabIndex={-1}
      >
        <div className={styles.resizeGrip} />
      </button>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <MonitorIcon />
          <span>{config.name}</span>
          {isConnecting && <span className={styles.connectingBadge}>Connecting...</span>}
        </div>
        <div className={styles.actions}>
          {maximizedIndex !== null && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setMaximizedIndex(null)}
              title="Restore all"
            >
              <RestoreIcon />
            </button>
          )}
          <button type="button" className={styles.actionBtn} onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div className={styles.errorBanner}>
          <span>{connectionError}</span>
        </div>
      )}

      {/* Monitor Windows */}
      <div className={styles.windowsContainer}>
        {sessions.map((session, index) => {
          const isMaximized = maximizedIndex === index;
          const isHidden = maximizedIndex !== null && !isMaximized;

          return (
            <div
              key={session.sessionId}
              className={`${styles.window} ${isMaximized ? styles.maximizedWindow : ""} ${isHidden ? styles.hiddenWindow : ""}`}
              style={
                maximizedIndex === null
                  ? { flex: `1 1 ${100 / Math.max(visibleCount, 1)}%` }
                  : undefined
              }
            >
              {/* Window Header */}
              <button
                type="button"
                className={styles.windowHeader}
                onClick={() => session.isReady && toggleMaximize(index)}
                title={isMaximized ? "Click to restore" : "Click to maximize"}
              >
                <div className={styles.windowTitle}>
                  <FileIcon />
                  <span className={styles.windowName}>{session.name}</span>
                  <span className={styles.windowPath}>{session.filePath}</span>
                </div>
                <div className={styles.windowActions}>
                  {!session.isReady && (
                    <span className={styles.windowLoading}>Initializing...</span>
                  )}
                  {isMaximized ? <MinimizeIcon /> : <MaximizeIcon />}
                </div>
              </button>

              {/* Terminal Container */}
              <div
                className={styles.terminalContainer}
                ref={(el) => {
                  if (el) terminalRefs.current.set(session.sessionId, el);
                }}
              />
            </div>
          );
        })}

        {sessions.length === 0 && isConnecting && (
          <div className={styles.emptyState}>
            <MonitorIcon className={styles.emptyIcon} />
            <p>Initializing log monitor sessions...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="14"
      height="14"
      className={className}
      role="img"
      aria-label="Monitor"
    >
      <title>Monitor</title>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M6 8h.01M6 12h.01M10 8h8M10 12h8" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="12"
      height="12"
      role="img"
      aria-label="File"
    >
      <title>File</title>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="12"
      height="12"
      role="img"
      aria-label="Maximize"
    >
      <title>Maximize</title>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="12"
      height="12"
      role="img"
      aria-label="Minimize"
    >
      <title>Minimize</title>
      <path d="M4 14h6m-6-4v6m16-6h-6m6 4v-6M10 4v6m4-6v6m-4 14v-6m4 6v-6" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="14"
      height="14"
      role="img"
      aria-label="Restore"
    >
      <title>Restore</title>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="14"
      height="14"
      role="img"
      aria-label="Close"
    >
      <title>Close</title>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
