/**
 * ProcessTreeViewer - System process tree viewer
 * Compact design, display all process details
 */

import { useCallback, useEffect, useState } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { websocketService } from "@/services/websocket.service";
import menuStyles from "@/app/Tools/ToolMenu.module.css";
import styles from "./ProcessTreeViewer.module.css";

interface ProcessInfo {
  pid: number;
  ppid: number;
  uid: number;
  gid: number;
  command: string;
  args: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
  children?: ProcessInfo[];
  depth?: number;
  isServerProcess?: boolean;
  isSessionProcess?: boolean;
  sessionId?: string;
}

interface ProcessStats {
  total: number;
  running: number;
  sleeping: number;
  zombie: number;
  serverChildren: number;
}

interface ProcessTreeData {
  processes: ProcessInfo[];
  tree: ProcessInfo[];
  serverProcess?: ProcessInfo | null;
  serverChildren?: ProcessInfo[];
  serverSessions?: ProcessInfo[];
  stats: ProcessStats;
}

interface ProcessDetails {
  pid: number;
  threads: Array<{
    tid: number;
    pid: number;
    cpu: number;
    stat: string;
    time: string;
    command: string;
  }>;
  openFiles: string[];
  threadCount: number;
}

export function ProcessTreeViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tree" | "server" | "flat">("server");
  const [data, setData] = useState<ProcessTreeData | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [processDetails, setProcessDetails] = useState<ProcessDetails | null>(null);
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const serverPid = useSessionStore((state) => state.serverPid);

  // Get process tree data
  const fetchData = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const response = await new Promise<ProcessTreeData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout"));
        }, 10000);

        const handler = (data: any) => {
          clearTimeout(timeout);
          cleanup();
          resolve(data);
        };

        const errorHandler = (data: any) => {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(data?.message || "Unknown error"));
        };

        const unsub = websocketService.on("process_tree_data", handler);
        const unsubError = websocketService.on("error", errorHandler);

        function cleanup() {
          unsub();
          unsubError();
        }

        // Send WebSocket request
        websocketService.send("get_process_tree", { serverPid });
      });

      setData(response);

      // Default expand server processes
      if (response.serverProcess) {
        setExpandedPids(new Set([response.serverProcess.pid]));
      }
    } catch (error) {
      console.error("[ProcessTreeViewer] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, serverPid]);

  // Get process details
  const fetchProcessDetails = useCallback(async (pid: number) => {
    try {
      const response = await new Promise<ProcessDetails>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout"));
        }, 5000);

        const handler = (data: ProcessDetails) => {
          if (data.pid === pid) {
            clearTimeout(timeout);
            cleanup();
            resolve(data);
          }
        };

        const unsub = websocketService.on("process_details", handler);

        function cleanup() {
          unsub();
        }

        websocketService.send("get_process_details", { pid });
      });

      setProcessDetails(response);
    } catch (error) {
      console.error("[ProcessTreeViewer] Failed to fetch details:", error);
    }
  }, []);

  // Get data once when opening window（不自动刷新）
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Get details when process selected
  useEffect(() => {
    if (selectedPid) {
      fetchProcessDetails(selectedPid);
    } else {
      setProcessDetails(null);
    }
  }, [selectedPid, fetchProcessDetails]);

  // Toggle expand state
  const toggleExpand = useCallback((pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }, []);

  // Format bytes
  const formatBytes = (kb: number) => {
    if (kb > 1048576) return `${(kb / 1048576).toFixed(1)}G`;
    if (kb > 1024) return `${(kb / 1024).toFixed(1)}M`;
    return `${kb}K`;
  };

  // Render process row
  const renderProcessRow = (proc: ProcessInfo, isServerChild = false) => {
    const isExpanded = expandedPids.has(proc.pid);
    const isSelected = selectedPid === proc.pid;
    const hasChildren = proc.children && proc.children.length > 0;
    const indent = proc.depth || 0;

    return (
      <div key={proc.pid}>
        <div
          className={`${styles.processRow} ${isSelected ? styles.selected : ""} ${
            proc.isServerProcess ? styles.serverProcess : ""
          } ${proc.isSessionProcess ? styles.sessionProcess : ""} ${isServerChild ? styles.serverChild : ""}`}
          style={{ paddingLeft: `${indent * 12 + 4}px` }}
          onClick={() => setSelectedPid(proc.pid)}
        >
          <span className={styles.expandBtn} onClick={(e) => { e.stopPropagation(); toggleExpand(proc.pid); }}>
            {hasChildren ? (isExpanded ? "▼" : "▶") : " "}
          </span>
          <span className={styles.pid}>{proc.pid}</span>
          <span className={styles.ppid}>{proc.ppid}</span>
          <span className={styles.cpu}>{proc.cpu.toFixed(1)}</span>
          <span className={styles.mem}>{proc.mem.toFixed(1)}</span>
          <span className={styles.vsz}>{formatBytes(proc.vsz)}</span>
          <span className={styles.rss}>{formatBytes(proc.rss)}</span>
          <span className={styles.stat}>{proc.stat}</span>
          <span className={styles.time}>{proc.time}</span>
          <span className={styles.command} title={proc.args}>
            {proc.isServerProcess && "🟢 "}
            {proc.isSessionProcess && "🔸 "}
            {proc.command}
          </span>
        </div>
        {isExpanded && proc.children?.map((child) => renderProcessRow(child, isServerChild))}
      </div>
    );
  };

  // Render server child processes
  const renderServerChildren = () => {
    if (!data?.serverChildren?.length) return null;

    return (
      <div className={styles.serverChildrenSection}>
        <div className={styles.sectionTitle}>
          Server Children ({data.serverChildren.length})
        </div>
        {data.serverChildren.map((proc) => (
          <div
            key={proc.pid}
            className={`${styles.processRow} ${selectedPid === proc.pid ? styles.selected : ""} ${
              proc.isSessionProcess ? styles.sessionProcess : ""
            }`}
            onClick={() => setSelectedPid(proc.pid)}
          >
            <span className={styles.expandBtn}> </span>
            <span className={styles.pid}>{proc.pid}</span>
            <span className={styles.ppid}>{proc.ppid}</span>
            <span className={styles.cpu}>{proc.cpu.toFixed(1)}</span>
            <span className={styles.mem}>{proc.mem.toFixed(1)}</span>
            <span className={styles.vsz}>{formatBytes(proc.vsz)}</span>
            <span className={styles.rss}>{formatBytes(proc.rss)}</span>
            <span className={styles.stat}>{proc.stat}</span>
            <span className={styles.time}>{proc.time}</span>
            <span className={styles.command} title={proc.args}>
              {proc.isSessionProcess && "🔸 "}
              {proc.command}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Render thread info
  const renderThreads = () => {
    if (!processDetails?.threads?.length) return null;

    return (
      <div className={styles.threadsSection}>
        <div className={styles.sectionTitle}>Threads ({processDetails.threadCount})</div>
        <div className={styles.threadsList}>
          {processDetails.threads.map((t) => (
            <div key={t.tid} className={styles.threadRow}>
              <span className={styles.tid}>TID:{t.tid}</span>
              <span className={styles.threadCpu}>{t.cpu.toFixed(1)}%</span>
              <span className={styles.threadStat}>{t.stat}</span>
              <span className={styles.threadTime}>{t.time}</span>
              <span className={styles.threadCmd}>{t.command}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render open files
  const renderOpenFiles = () => {
    if (!processDetails?.openFiles?.length) return null;

    return (
      <div className={styles.filesSection}>
        <div className={styles.sectionTitle}>Open Files ({processDetails.openFiles.length})</div>
        <div className={styles.filesList}>
          {processDetails.openFiles.map((file, i) => (
            <div key={i} className={styles.fileRow}>{file}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <button type="button" className={menuStyles.item} onClick={() => setIsOpen(true)}>
        <span className={menuStyles.menuIcon}>🌳</span>
        <span>Process Tree</span>
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.header}>
              <span className={styles.title}>Process Tree</span>
              <div className={styles.stats}>
                {data && (
                  <>
                    <span>Total:{data.stats.total}</span>
                    <span className={styles.running}>R:{data.stats.running}</span>
                    <span className={styles.sleeping}>S:{data.stats.sleeping}</span>
                    {data.stats.serverChildren > 0 && (
                      <span className={styles.server}>Srv:{data.stats.serverChildren}</span>
                    )}
                  </>
                )}
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "server" ? styles.active : ""}`}
                onClick={() => setActiveTab("server")}
              >
                Server{data?.serverChildren ? `(${data.serverChildren.length})` : ""}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "tree" ? styles.active : ""}`}
                onClick={() => setActiveTab("tree")}
              >
                Tree
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "flat" ? styles.active : ""}`}
                onClick={() => setActiveTab("flat")}
              >
                Flat
              </button>
              <button type="button" className={styles.refreshBtn} onClick={fetchData} disabled={isLoading}>
                {isLoading ? "⏳" : "🔄"}
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              {/* Column Headers */}
              <div className={styles.headerRow}>
                <span className={styles.expandBtn}> </span>
                <span className={styles.pid}>PID</span>
                <span className={styles.ppid}>PPID</span>
                <span className={styles.cpu}>CPU%</span>
                <span className={styles.mem}>MEM%</span>
                <span className={styles.vsz}>VSZ</span>
                <span className={styles.rss}>RSS</span>
                <span className={styles.stat}>STAT</span>
                <span className={styles.time}>TIME</span>
                <span className={styles.command}>COMMAND</span>
              </div>

              {/* Process List */}
              <div className={styles.processList}>
                {activeTab === "server" && (
                  <>
                    {data?.serverProcess && renderProcessRow(data.serverProcess)}
                    {renderServerChildren()}
                  </>
                )}
                {activeTab === "tree" && data?.tree.map((proc) => renderProcessRow(proc))}
                {activeTab === "flat" &&
                  data?.processes.map((proc) => (
                    <div
                      key={proc.pid}
                      className={`${styles.processRow} ${selectedPid === proc.pid ? styles.selected : ""} ${
                        proc.isServerProcess ? styles.serverProcess : ""
                      }`}
                      onClick={() => setSelectedPid(proc.pid)}
                    >
                      <span className={styles.expandBtn}> </span>
                      <span className={styles.pid}>{proc.pid}</span>
                      <span className={styles.ppid}>{proc.ppid}</span>
                      <span className={styles.cpu}>{proc.cpu.toFixed(1)}</span>
                      <span className={styles.mem}>{proc.mem.toFixed(1)}</span>
                      <span className={styles.vsz}>{formatBytes(proc.vsz)}</span>
                      <span className={styles.rss}>{formatBytes(proc.rss)}</span>
                      <span className={styles.stat}>{proc.stat}</span>
                      <span className={styles.time}>{proc.time}</span>
                      <span className={styles.command} title={proc.args}>
                        {proc.isServerProcess && "🟢 "}
                        {proc.command}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Selected Process Details */}
              {selectedPid && processDetails && (
                <div className={styles.detailsPanel}>
                  <div className={styles.detailsHeader}>
                    <span>PID: {selectedPid}</span>
                    <button type="button" onClick={() => setSelectedPid(null)}>✕</button>
                  </div>
                  {renderThreads()}
                  {renderOpenFiles()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
