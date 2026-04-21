/**
 * MultiSessionTerminalPanel - WebSocket-based Multi-Terminal Component
 *
 * Features:
 * - Multiple terminal sessions via single WebSocket
 * - Tab-based session switching
 * - Stream-based output display using xterm.js
 * - Session management (create, close, rename)
 *
 * Architecture:
 * - Uses TerminalWebSocketService for server communication
 * - Uses TerminalStore for state management
 * - Each session has its own xterm.js instance
 */

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalStore } from "@/features/files/stores";
import { terminalWebSocketService } from "@/services/terminal-websocket.service";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import "@xterm/xterm/css/xterm.css";
import styles from "./MultiSessionTerminalPanel.module.css";

// ============================================================================
// Types
// ============================================================================

interface MultiSessionTerminalPanelProps {
  height: number;
  onClose: () => void;
  onHeightChange: (height: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function MultiSessionTerminalPanel({
  height,
  onClose,
  onHeightChange,
}: MultiSessionTerminalPanelProps) {
  // ========== 1. Global State ==========
  // Use getState to avoid re-renders from selector creating new array references
  const sessionsMap = useTerminalStore((state) => state.sessions);
  const sessions = Array.from(sessionsMap.values());
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const activeSession = activeSessionId ? sessionsMap.get(activeSessionId) : undefined;
  // Panel open state is managed by parent, but we read it for display purposes
  useTerminalStore((state) => state.isPanelOpen); // Subscribe to changes
  const panelHeight = useTerminalStore((state) => state.panelHeight);
  const workingDir = useWorkspaceStore((s) => s.workingDir);

  const {
    setActiveSession,
    createSession,
    closeSession,
    appendOutput,
    markSessionActive,
    markSessionConnected,
    setConnected,
    setError,
    executeCommand,
  } = useTerminalStore();

  // ========== 2. Local State ==========
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");

  // ========== 3. Refs ==========
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const terminalInstances = useRef<Map<string, Terminal>>(new Map());
  const fitAddons = useRef<Map<string, FitAddon>>(new Map());
  const _resizeObserver = useRef<ResizeObserver | null>(null);
  const isResizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);
  // Use ref to avoid stale closure in xterm event handlers
  const executeCommandRef = useRef(executeCommand);
  executeCommandRef.current = executeCommand;

  // ========== 4. WebSocket Setup ==========
  // Track if initial session has been created
  const initialSessionCreatedRef = useRef(false);

  useEffect(() => {
    // Connect to terminal WebSocket
    const connect = async () => {
      try {
        await terminalWebSocketService.connect();
        setConnected(true);

        // Create initial session if none exists (only once)
        if (!initialSessionCreatedRef.current) {
          initialSessionCreatedRef.current = true;
          const store = useTerminalStore.getState();
          if (store.getSessionCount() === 0) {
            store.createSession("Terminal 1", workingDir);
          }
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Connection failed");
      }
    };

    connect();

    // Setup event listeners
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      terminalWebSocketService.on(
        "terminal_created",
        (data: { sessionId: string; name: string; workingDir: string; createdAt: string }) => {
          const { sessionId, name, workingDir, createdAt } = data;

          // Add to store
          useTerminalStore.setState(
            (state) => {
              const newSessions = new Map(state.sessions);
              newSessions.set(sessionId, {
                id: sessionId,
                name: name || `Terminal ${state.sessions.size + 1}`,
                workingDir:
                  workingDir || state.sessions.get(state.activeSessionId || "")?.workingDir || "/",
                createdAt: createdAt || new Date().toISOString(),
                output: "",
                isActive: false,
                isConnected: true,
              });
              return {
                sessions: newSessions,
                activeSessionId: sessionId, // Auto-switch to new session
              };
            },
            false,
            "terminal_created"
          );
        }
      )
    );

    unsubscribers.push(
      terminalWebSocketService.on(
        "terminal_output",
        (data: { sessionId: string; data: string; isError?: boolean }) => {
          const { sessionId, data: outputData, isError } = data;
          appendOutput(sessionId, outputData, isError);
        }
      )
    );

    unsubscribers.push(
      terminalWebSocketService.on(
        "terminal_ended",
        (data: { sessionId: string; exitCode?: number }) => {
          const { sessionId, exitCode } = data;
          markSessionActive(sessionId, false);
          if (exitCode !== undefined) {
            appendOutput(sessionId, `\r\n[Process exited with code ${exitCode}]\r\n`);
          }
        }
      )
    );

    unsubscribers.push(
      terminalWebSocketService.on(
        "terminal_error",
        (data: { sessionId?: string; error: string }) => {
          const { sessionId, error } = data;
          if (sessionId) {
            appendOutput(sessionId, `\r\n[Error: ${error}]\r\n`, true);
            markSessionConnected(sessionId, false);
          }
        }
      )
    );

    unsubscribers.push(
      terminalWebSocketService.on("disconnected", () => {
        setConnected(false);
        // Mark all sessions as disconnected using getState to avoid stale closure
        const currentSessions = useTerminalStore.getState().sessions;
        currentSessions.forEach((session) => {
          useTerminalStore.getState().markSessionConnected(session.id, false);
        });
      })
    );

    unsubscribers.push(
      terminalWebSocketService.on("connected", () => {
        setConnected(true);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => {
        unsub();
      });
      terminalWebSocketService.disconnect();
    };
  }, [appendOutput, markSessionActive, markSessionConnected, setConnected, setError, workingDir]);

  // ========== 5. Terminal Initialization ==========
  // Track processed sessions to avoid infinite loops
  const processedSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initialize terminals for new sessions
    sessions.forEach((session) => {
      if (
        !terminalInstances.current.has(session.id) &&
        !processedSessionsRef.current.has(session.id)
      ) {
        processedSessionsRef.current.add(session.id);
        initTerminal(session.id);
      }
    });

    // Cleanup terminals for closed sessions
    const sessionIds = new Set(sessions.map((s) => s.id));
    terminalInstances.current.forEach((_, id) => {
      if (!sessionIds.has(id)) {
        processedSessionsRef.current.delete(id);
        disposeTerminal(id);
      }
    });
  }, [
    disposeTerminal,
    initTerminal, // Initialize terminals for new sessions
    sessions.forEach,
    sessions.map,
  ]); // Only depend on size, not the array itself

  // Focus active terminal
  useEffect(() => {
    if (activeSession) {
      const term = terminalInstances.current.get(activeSession.id);
      if (term) {
        setTimeout(() => term.focus(), 100);
      }
    }
  }, [activeSession?.id, activeSession]);

  // ========== 6. Terminal Helpers ==========
  const initTerminal = async (sessionId: string) => {
    const container = terminalRefs.current.get(sessionId);
    if (!container) return;

    // Wait for container to have size
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      setTimeout(() => initTerminal(sessionId), 100);
      return;
    }

    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace',
      lineHeight: 1.3,
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "#264f78",
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
      // Report size to server
      const { cols, rows } = term;
      terminalWebSocketService.resizeTerminal(sessionId, cols, rows);
    });

    // Handle input
    let commandBuffer = "";
    term.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        // Enter
        term.writeln("");
        if (commandBuffer.trim()) {
          // Use ref to avoid stale closure
          executeCommandRef.current(sessionId, commandBuffer);
        }
        commandBuffer = "";
      } else if (code === 127) {
        // Backspace
        if (commandBuffer.length > 0) {
          commandBuffer = commandBuffer.slice(0, -1);
          term.write("\b \b");
        }
      } else if (code === 3) {
        // Ctrl+C
        term.writeln("^C");
        commandBuffer = "";
      } else if (code === 12) {
        // Ctrl+L (clear)
        term.clear();
      } else if (code >= 32 && code < 127) {
        // Printable characters
        commandBuffer += data;
        term.write(data);
      }
    });

    terminalInstances.current.set(sessionId, term);
    fitAddons.current.set(sessionId, fitAddon);

    // Note: Don't write initial prompt here
    // Bash will output its own prompt when ready
    // We just ensure the terminal is focused
    term.focus();
  };

  const disposeTerminal = (sessionId: string) => {
    const term = terminalInstances.current.get(sessionId);
    if (term) {
      term.dispose();
      terminalInstances.current.delete(sessionId);
    }
    fitAddons.current.delete(sessionId);
    terminalRefs.current.delete(sessionId);
  };

  // ========== 7. Sync Output to XTerm ==========
  // Use a ref to track output lengths to avoid infinite loops
  const outputLengthsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    sessions.forEach((session) => {
      const term = terminalInstances.current.get(session.id);
      if (!term) return;

      const lastLength = outputLengthsRef.current.get(session.id) || 0;
      const currentLength = session.output.length;

      if (currentLength > lastLength) {
        const newOutput = session.output.slice(lastLength);
        term.write(newOutput);
        outputLengthsRef.current.set(session.id, currentLength);
      }
    });
  }, [sessions]);

  // ========== 8. Resize Handling ==========
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      isResizing.current = true;
      resizeStartY.current = e.clientY;
      resizeStartHeight.current = panelHeight;
      e.preventDefault();
    },
    [panelHeight]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, resizeStartHeight.current + delta));
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

  // Fit terminals on resize
  useEffect(() => {
    const handleResize = () => {
      fitAddons.current.forEach((fitAddon, sessionId) => {
        try {
          fitAddon.fit();
          const term = terminalInstances.current.get(sessionId);
          if (term) {
            const { cols, rows } = term;
            terminalWebSocketService.resizeTerminal(sessionId, cols, rows);
          }
        } catch {
          // Ignore fit errors
        }
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ========== 9. UI Actions ==========
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleCreateSession = () => {
    const name = newSessionName.trim() || `Terminal ${sessions.length + 1}`;
    createSession(name, workingDir);
    setNewSessionName("");
    setShowNewSessionDialog(false);
  };

  const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeSession(sessionId);
  };

  // ========== 10. Render ==========
  const displayHeight = isFullscreen ? "100vh" : `${panelHeight}px`;

  return (
    <div
      className={`${styles.panel} ${isFullscreen ? styles.fullscreen : ""}`}
      style={{ height: displayHeight }}
    >
      {/* Resize Handle */}
      {!isFullscreen && (
        <div className={styles.resizeHandle} onMouseDown={handleResizeStart}>
          <div className={styles.resizeGrip} />
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.tab} ${activeSession?.id === session.id ? styles.activeTab : ""}`}
              onClick={() => setActiveSession(session.id)}
            >
              <TerminalIcon className={styles.tabIcon} />
              <span className={styles.tabName}>{session.name}</span>
              {!session.isConnected && (
                <span className={styles.disconnectedIndicator} title="Disconnected" />
              )}
              <button
                className={styles.closeTabBtn}
                onClick={(e) => handleCloseSession(e, session.id)}
                title="Close terminal"
              >
                <CloseIcon />
              </button>
            </div>
          ))}

          <button
            className={styles.addTabBtn}
            onClick={() => setShowNewSessionDialog(true)}
            title="New terminal"
          >
            <PlusIcon />
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
          <button type="button" className={styles.actionBtn} onClick={onClose} title="Close panel">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Terminal Containers */}
      <div className={styles.terminalContainer}>
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`${styles.terminalWrapper} ${
              activeSession?.id === session.id ? styles.activeTerminal : styles.hiddenTerminal
            }`}
            ref={(el) => {
              if (el) terminalRefs.current.set(session.id, el);
            }}
          />
        ))}

        {sessions.length === 0 && (
          <div className={styles.emptyState}>
            <TerminalIcon className={styles.emptyIcon} />
            <p>No terminal sessions</p>
            <button className={styles.createBtn} onClick={() => setShowNewSessionDialog(true)}>
              Create Terminal
            </button>
          </div>
        )}
      </div>

      {/* New Session Dialog */}
      {showNewSessionDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowNewSessionDialog(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3>New Terminal Session</h3>
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder={`Terminal ${sessions.length + 1}`}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
            />
            <div className={styles.dialogActions}>
              <button onClick={() => setShowNewSessionDialog(false)}>Cancel</button>
              <button onClick={handleCreateSession} className={styles.primaryBtn}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="14"
      height="14"
      className={className}
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="14"
      height="14"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="14"
      height="14"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="14"
      height="14"
    >
      <path d="M4 14h6m-6-4v6m16-6h-6m6 4v-6M10 4v6m4-6v6m-4 14v-6m4 6v-6" />
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
      width="12"
      height="12"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
