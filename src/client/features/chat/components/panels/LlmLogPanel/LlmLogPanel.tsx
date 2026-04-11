/**
 * LlmLogPanel - LLM API Log Viewer as Bottom Panel
 * Real-time HTTP request/response log display
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./LlmLogPanel.module.css";

interface LlmLogPanelProps {
  height: number;
  onClose: () => void;
  onHeightChange: (height: number) => void;
}

interface LogEntry {
  timestamp: string;
  type: "request" | "response";
  model?: string;
  content: string;
  parsed?: {
    method?: string;
    url?: string;
    status?: number;
    statusText?: string;
    duration?: string;
    headers?: Record<string, string>;
    body?: string;
    bodyNote?: string;
    protocol?: string;
    host?: string;
    pathname?: string;
    search?: string;
  };
}

export function LlmLogPanel({ height, onClose, onHeightChange }: LlmLogPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isResizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);

  // Fetch logs from API
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/llm-log");
      if (response.ok) {
        const data = await response.json();
        if (data.logContent && Array.isArray(data.logContent)) {
          const parsedLogs: LogEntry[] = data.logContent
            .map((entry: any) => parseLogEntry(entry))
            .filter(Boolean) as LogEntry[];
          setLogs(parsedLogs);
        }
      }
    } catch (error) {
      console.error("[LlmLogPanel] Failed to fetch logs:", error);
    }
  }, [parseLogEntry]);

  // Parse a log entry into structured format
  const parseLogEntry = (entry: any): LogEntry | null => {
    if (!entry?.type) return null;

    try {
      const parsedContent = JSON.parse(entry.content);
      return {
        timestamp: entry.timestamp || new Date().toISOString(),
        type: entry.type,
        model: entry.model,
        content: entry.content,
        parsed: parsedContent,
      };
    } catch {
      return {
        timestamp: entry.timestamp || new Date().toISOString(),
        type: entry.type,
        model: entry.model,
        content: entry.content,
      };
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    setIsLoading(true);
    fetchLogs().finally(() => setIsLoading(false));

    intervalRef.current = setInterval(fetchLogs, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (contentRef.current && autoScroll && !isFullscreen) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [autoScroll, isFullscreen]);

  // Handle manual scroll
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Resize handlers
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
      const newHeight = Math.max(120, Math.min(600, resizeStartHeight.current + delta));
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

  // Keyboard shortcut to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    fetchLogs().finally(() => setIsLoading(false));
  }, [fetchLogs]);

  const handleLogClick = (log: LogEntry) => {
    setSelectedLog(log);
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
    setTimeout(() => setSelectedLog(null), 200);
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getStatusColorClass = (status?: number): string => {
    if (!status) return styles.info;
    if (status >= 200 && status < 300) return styles.success;
    if (status >= 400) return styles.error;
    return styles.warn;
  };

  const truncateUrl = (url?: string, maxLength: number = 50): string => {
    if (!url) return "";
    if (url.length <= maxLength) return url;
    return `${url.substring(0, maxLength)}...`;
  };

  // Format body content with syntax highlighting
  const formatBody = (body?: string): string => {
    if (!body) return "";
    try {
      // Try to parse and format JSON
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not valid JSON
      return body;
    }
  };

  // Build summary text for a log entry
  const buildSummary = (log: LogEntry): string => {
    const { parsed, type } = log;
    if (!parsed) return type === "request" ? "Request" : "Response";

    if (type === "request") {
      const parts: string[] = [];
      if (parsed.method) parts.push(parsed.method);
      if (parsed.pathname) parts.push(parsed.pathname);
      return parts.join(" ") || "Request";
    } else {
      const parts: string[] = [];
      if (parsed.status) parts.push(`${parsed.status}`);
      if (parsed.statusText) parts.push(parsed.statusText);
      if (parsed.duration) parts.push(`(${parsed.duration})`);
      return parts.join(" ") || "Response";
    }
  };

  return (
    <div
      className={`${styles.panel} ${isFullscreen ? styles.fullscreen : ""}`}
      style={{ height: isFullscreen ? "100vh" : `${height}px` }}
    >
      {/* Resize handle */}
      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} title="Drag to resize">
        <div className={styles.resizeGrip} />
      </div>

      {/* Compact Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <LogIcon />
          <span>LLM Logs</span>
          <span className={styles.logCount}>{logs.length}</span>
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${autoScroll ? styles.active : ""}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
          >
            <ScrollIcon />
          </button>
          <button
            className={styles.actionBtn}
            onClick={handleRefresh}
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshIcon />
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
          <button className={styles.actionBtn} onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Compact Log List */}
      <div ref={contentRef} className={styles.content} onScroll={handleScroll}>
        {isLoading && logs.length === 0 ? (
          <div className={styles.loading}>Loading...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📡</span>
            <span>No logs yet</span>
          </div>
        ) : (
          <div className={styles.logList}>
            {logs.map((log, index) => (
              <div
                key={index}
                className={`${styles.logEntry} ${
                  log.type === "request" ? styles.request : styles.response
                }`}
                onClick={() => handleLogClick(log)}
                title="Click to view details"
              >
                <div className={styles.logRow}>
                  <span className={styles.logTime}>{formatTimestamp(log.timestamp)}</span>
                  <span
                    className={`${styles.logType} ${
                      log.type === "request" ? styles.typeRequest : styles.typeResponse
                    }`}
                  >
                    {log.type === "request" ? "→" : "←"}
                  </span>
                  <span className={styles.logSummary}>{buildSummary(log)}</span>
                  {log.parsed?.status && (
                    <span
                      className={`${styles.statusBadge} ${getStatusColorClass(log.parsed.status)}`}
                    >
                      {log.parsed.status}
                    </span>
                  )}
                </div>
                {log.parsed?.url && (
                  <div className={styles.logUrl}>{truncateUrl(log.parsed.url)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Detail Modal */}
      {isFullscreen && selectedLog && (
        <div className={styles.modalOverlay} onClick={handleCloseFullscreen}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span
                  className={
                    selectedLog.type === "request" ? styles.typeRequest : styles.typeResponse
                  }
                >
                  {selectedLog.type === "request" ? "➡️ Request" : "⬅️ Response"}
                </span>
                <span className={styles.modalTime}>{formatTimestamp(selectedLog.timestamp)}</span>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={handleCloseFullscreen}
                title="Close (Esc)"
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Request Line / Status Line */}
              <div className={styles.modalSection}>
                {selectedLog.type === "request" ? (
                  <div className={styles.statusLine}>
                    <span className={styles.method}>{selectedLog.parsed?.method || "GET"}</span>
                    <span className={styles.fullUrl}>{selectedLog.parsed?.url || "Unknown"}</span>
                  </div>
                ) : (
                  <div className={styles.statusLine}>
                    <span
                      className={`${styles.statusCode} ${getStatusColorClass(
                        selectedLog.parsed?.status
                      )}`}
                    >
                      {selectedLog.parsed?.status || "???"}
                    </span>
                    <span className={styles.statusText}>
                      {selectedLog.parsed?.statusText || "Unknown"}
                    </span>
                    {selectedLog.parsed?.duration && (
                      <span className={styles.duration}>({selectedLog.parsed.duration})</span>
                    )}
                  </div>
                )}
              </div>

              {/* Headers */}
              {selectedLog.parsed?.headers &&
                Object.keys(selectedLog.parsed.headers).length > 0 && (
                  <div className={styles.modalSection}>
                    <div className={styles.sectionTitle}>Headers</div>
                    <div className={styles.codeBlock}>
                      {Object.entries(selectedLog.parsed.headers).map(([key, value]) => (
                        <div key={key} className={styles.headerLine}>
                          <span className={styles.headerName}>{key}:</span>
                          <span className={styles.headerValue}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Body */}
              {(selectedLog.parsed?.body || selectedLog.parsed?.bodyNote) && (
                <div className={styles.modalSection}>
                  <div className={styles.sectionTitle}>Body</div>
                  {selectedLog.parsed.bodyNote ? (
                    <div className={styles.bodyNote}>{selectedLog.parsed.bodyNote}</div>
                  ) : (
                    <pre className={styles.codeBlock}>
                      <code>{formatBody(selectedLog.parsed.body)}</code>
                    </pre>
                  )}
                </div>
              )}

              {/* Raw JSON */}
              <div className={styles.modalSection}>
                <div className={styles.sectionTitle}>Raw Data</div>
                <pre className={styles.codeBlock}>
                  <code>{JSON.stringify(JSON.parse(selectedLog.content), null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function LogIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14"
      height="14"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="12"
      height="12"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="12"
      height="12"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14"
      height="14"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
      strokeLinecap="round"
      strokeLinejoin="round"
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
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14"
      height="14"
    >
      <path d="M4 14h6m-6-4v6m16-6h-6m6 4v-6M10 4v6m4-6v6m-4 14v-6m4 6v-6" />
    </svg>
  );
}
