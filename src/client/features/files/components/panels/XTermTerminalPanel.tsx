/**
 * XTermTerminalPanel - 使用 xterm.js 的终端面板
 * 
 * 改进：
 * 1. WebSocket 输出直接写入 xterm，不经过 store 中转
 * 2. 支持正确的中文和特殊chars显示
 * 3. 输入时界面自动调整（类似 Chat InputArea）
 */

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalStore } from "@/features/files/stores/terminalStore";
import { terminalWebSocketService } from "@/services/terminal-websocket.service";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import "@xterm/xterm/css/xterm.css";
import styles from "./XTermTerminalPanel.module.css";

interface XTermTerminalPanelProps {
  height: number;
  onClose: () => void;
  onHeightChange: (height: number) => void;
}

export function XTermTerminalPanel({
  height,
  onClose,
  onHeightChange,
}: XTermTerminalPanelProps) {
  // ========== State ==========
  const sessionsMap = useTerminalStore((state) => state.sessions);
  const sessions = Array.from(sessionsMap.values());
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const activeSession = activeSessionId ? sessionsMap.get(activeSessionId) : undefined;
  
  const {
    setActiveSession,
    createSession,
    closeSession,
    markSessionActive,
    setConnected,
    setError,
  } = useTerminalStore();

  const workingDir = useWorkspaceStore((s) => s.workingDir);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [isInputActive, setIsInputActive] = useState(false);

  // ========== Refs ==========
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const terminalInstances = useRef<Map<string, Terminal>>(new Map());
  const fitAddons = useRef<Map<string, FitAddon>>(new Map());
  const commandBuffers = useRef<Map<string, string>>(new Map());
  const isResizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);
  const panelRef = useRef<HTMLDivElement>(null);
  const originalHeightRef = useRef(height);

  // ========== Keyboard handling ==========
  useEffect(() => {
    // Detect virtual keyboard on mobile
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;
        
        // If keyboard is open (> 150px), push panel up
        if (keyboardHeight > 150) {
          setIsInputActive(true);
          // Store original height
          if (!originalHeightRef.current) {
            originalHeightRef.current = height;
          }
          // Increase panel height when keyboard is open
          onHeightChange(Math.min(400, windowHeight * 0.5));
        } else {
          setIsInputActive(false);
          // Restore original height
          if (originalHeightRef.current) {
            onHeightChange(originalHeightRef.current);
            originalHeightRef.current = 0;
          }
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      return () => window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, [height, onHeightChange]);

  // ========== WebSocket Setup ==========
  useEffect(() => {
    const connect = async () => {
      try {
        await terminalWebSocketService.connect();
        setConnected(true);
        
        if (useTerminalStore.getState().getSessionCount() === 0) {
          createSession("Terminal 1", workingDir);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Connection failed");
      }
    };

    connect();

    const unsubscribers: Array<() => void> = [];

    // 直接输出到 xterm，不经过 store
    // Handle session created - init terminal
    unsubscribers.push(
      terminalWebSocketService.on("terminal_created", (data: unknown) => {
        const typed = data as { sessionId: string; name: string; workingDir: string; createdAt: string };
        console.log("[Terminal] Session created:", typed.sessionId);
        // Add to store
        useTerminalStore.setState((state) => {
          const newSessions = new Map(state.sessions);
          newSessions.set(typed.sessionId, {
            id: typed.sessionId,
            name: typed.name,
            workingDir: typed.workingDir,
            createdAt: typed.createdAt,
            output: "",
            isActive: true,
            isConnected: true,
          });
          return {
            sessions: newSessions,
            activeSessionId: typed.sessionId,
          };
        });
      })
    );

    // Batch output for better performance
    const outputBuffer = new Map<string, string[]>();
    const flushBuffer = (sessionId: string) => {
      const buffer = outputBuffer.get(sessionId);
      if (!buffer || buffer.length === 0) return;
      
      const term = terminalInstances.current.get(sessionId);
      if (term) {
        // Write in chunks to avoid blocking
        const chunk = buffer.splice(0, buffer.length).join("");
        if (chunk) {
          term.write(chunk);
        }
      }
      outputBuffer.delete(sessionId);
    };

    // Flush buffers periodically
    const flushInterval = setInterval(() => {
      for (const sessionId of outputBuffer.keys()) {
        flushBuffer(sessionId);
      }
    }, 50); // 50ms batching

    unsubscribers.push(
      terminalWebSocketService.on("terminal_output", (data: unknown) => {
        const typed = data as { sessionId: string; data: string; isError?: boolean };
        const { sessionId, data: outputData } = typed;
        
        // Add to buffer instead of writing immediately
        if (!outputBuffer.has(sessionId)) {
          outputBuffer.set(sessionId, []);
        }
        outputBuffer.get(sessionId)!.push(outputData);
        
        // Flush if buffer gets too large
        if (outputBuffer.get(sessionId)!.length > 100) {
          flushBuffer(sessionId);
        }
      })
    );

    unsubscribers.push(
      terminalWebSocketService.on("terminal_ended", (data: unknown) => {
        const typed = data as { sessionId: string; exitCode?: number };
        const { sessionId, exitCode } = typed;
        markSessionActive(sessionId, false);
        const term = terminalInstances.current.get(sessionId);
        if (term && exitCode !== undefined) {
          term.writeln(`\r\n[Process exited with code ${exitCode}]`);
        }
      })
    );

    unsubscribers.push(
      terminalWebSocketService.on("terminal_error", (data: unknown) => {
        const typed = data as { sessionId?: string; error: string };
        const { sessionId, error } = typed;
        if (sessionId) {
          const term = terminalInstances.current.get(sessionId);
          if (term) {
            term.writeln(`\r\n[Error: ${error}]`);
          }
        }
      })
    );

    unsubscribers.push(
      terminalWebSocketService.on("disconnected", () => {
        setConnected(false);
      })
    );

    unsubscribers.push(
      terminalWebSocketService.on("connected", () => {
        setConnected(true);
      })
    );

    return () => {
      clearInterval(flushInterval);
      // Flush remaining data
      for (const sessionId of outputBuffer.keys()) {
        const buffer = outputBuffer.get(sessionId);
        if (buffer && buffer.length > 0) {
          const term = terminalInstances.current.get(sessionId);
          if (term) {
            term.write(buffer.join(""));
          }
        }
      }
      unsubscribers.forEach((unsub) => unsub());
      terminalWebSocketService.disconnect();
    };
  }, []);

  // ========== Terminal Initialization ==========
  useEffect(() => {
    sessions.forEach((session) => {
      if (!terminalInstances.current.has(session.id)) {
        initTerminal(session.id);
      }
    });

    // Cleanup
    const sessionIds = new Set(sessions.map((s) => s.id));
    terminalInstances.current.forEach((_, id) => {
      if (!sessionIds.has(id)) {
        disposeTerminal(id);
      }
    });
  }, [sessions.length]);

  // Focus active terminal
  useEffect(() => {
    if (activeSession) {
      const term = terminalInstances.current.get(activeSession.id);
      if (term) {
        setTimeout(() => term.focus(), 100);
      }
    }
  }, [activeSession?.id]);

  // ========== Terminal Helpers ==========
  const initTerminal = async (sessionId: string) => {
    const container = terminalRefs.current.get(sessionId);
    if (!container) return;

    if (container.clientWidth === 0 || container.clientHeight === 0) {
      setTimeout(() => initTerminal(sessionId), 100);
      return;
    }

    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 10,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace',
      lineHeight: 1.15,
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "#264f78",
      },
      scrollback: 3000,
      allowProposedApi: true,
      convertEol: true,
      rows: 40,
      cols: 120,
      tabStopWidth: 2,
      fastScrollModifier: "alt",
      fastScrollSensitivity: 5,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Initialize命令缓冲区
    commandBuffers.current.set(sessionId, "");

    // 初始大小调整
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        terminalWebSocketService.resizeTerminal(sessionId, cols, rows);
      } catch (e) {
        console.warn("Fit failed:", e);
      }
    });

    // 处理输入 - 直接发送到服务器
    term.onData((data) => {
      const code = data.charCodeAt(0);
      let buffer = commandBuffers.current.get(sessionId) || "";

      if (code === 13) {
        // Enter
        term.writeln("");
        if (buffer.trim()) {
          terminalWebSocketService.executeCommand(sessionId, buffer);
        }
        commandBuffers.current.set(sessionId, "");
      } else if (code === 127) {
        // Backspace
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          term.write("\b \b");
          commandBuffers.current.set(sessionId, buffer);
        }
      } else if (code === 3) {
        // Ctrl+C
        term.writeln("^C");
        terminalWebSocketService.executeCommand(sessionId, "\x03");
        commandBuffers.current.set(sessionId, "");
      } else if (code === 12) {
        // Ctrl+L
        term.clear();
      } else if (code >= 32 && code < 127) {
        // Printable
        buffer += data;
        term.write(data);
        commandBuffers.current.set(sessionId, buffer);
      } else if (data.length > 1) {
        // 多chars输入（如中文、特殊键）直接发送
        buffer += data;
        term.write(data);
        commandBuffers.current.set(sessionId, buffer);
      }
    });

    // 焦点处理 - 通过容器元素处理
    container.addEventListener("focusin", () => setIsInputActive(true));
    container.addEventListener("focusout", () => setIsInputActive(false));

    terminalInstances.current.set(sessionId, term);
    fitAddons.current.set(sessionId, fitAddon);
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
    commandBuffers.current.delete(sessionId);
  };

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
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [onHeightChange]);

  // Fit on window resize
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
        } catch (e) {
          // Ignore
        }
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ========== Actions ==========
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

  const displayHeight = isFullscreen ? "100vh" : `${height}px`;

  return (
    <div
      ref={panelRef}
      className={`${styles.panel} ${isFullscreen ? styles.fullscreen : ""} ${isInputActive ? styles.inputActive : ""}`}
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
              {!session.isConnected && <span className={styles.disconnectedIndicator} title="Disconnected" />}
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

// Icons
function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width="14" height="14" className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
      <path d="M4 14h6m-6-4v6m16-6h-6m6 4v-6M10 4v6m4-6v6m-4 14v-6m4 6v-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="12" height="12">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
