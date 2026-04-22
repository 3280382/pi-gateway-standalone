/**
 * PortUsageViewer - System port usage viewer
 * Display listening ports and their associated processes
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import menuStyles from "@/app/Tools/ToolMenu.module.css";
import { websocketService } from "@/services/websocket.service";
import styles from "./PortUsageViewer.module.css";

interface PortUsageInfo {
  protocol: string;
  state: string;
  localAddress: string;
  localPort: number;
  peerAddress: string;
  peerPort: string;
  pid: number | null;
  processName: string | null;
  user: string | null;
  fd: string | null;
}

interface PortUsageStats {
  total: number;
  tcp: number;
  udp: number;
  listening: number;
  established: number;
}

interface PortUsageData {
  ports: PortUsageInfo[];
  stats: PortUsageStats;
}

interface ProcessDetail {
  pid: number;
  name: string;
  command: string;
  cpu: number;
  mem: number;
  user: string;
  startTime: string;
}

type FilterType = "all" | "tcp" | "udp" | "listening" | "established";
type SortField = "port" | "protocol" | "state" | "process" | "pid";
type SortDir = "asc" | "desc";

export function PortUsageViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<PortUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("port");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [processDetail, setProcessDetail] = useState<ProcessDetail | null>(null);

  // Fetch port usage data
  const fetchData = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const response = await new Promise<PortUsageData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout"));
        }, 10000);

        const handler = (data: PortUsageData) => {
          clearTimeout(timeout);
          cleanup();
          resolve(data);
        };

        const errorHandler = (data: { message?: string } | unknown) => {
          clearTimeout(timeout);
          cleanup();
          const msg = (data as { message?: string })?.message || "Unknown error";
          reject(new Error(msg));
        };

        const unsub = websocketService.on("port_usage_data", handler);
        const unsubError = websocketService.on("error", errorHandler);

        function cleanup() {
          unsub();
          unsubError();
        }

        websocketService.send("get_port_usage", {});
      });

      setData(response);
    } catch (error) {
      console.error("[PortUsageViewer] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen]);

  // Fetch process details for selected PID
  const fetchProcessDetail = useCallback(async (pid: number) => {
    try {
      const response = await new Promise<ProcessDetail>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout"));
        }, 5000);

        const handler = (data: ProcessDetail & { pid: number }) => {
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

      setProcessDetail(response);
    } catch (error) {
      console.error("[PortUsageViewer] Failed to fetch process detail:", error);
    }
  }, []);

  // Get data when opening
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Get process details when selected
  useEffect(() => {
    if (selectedPid) {
      fetchProcessDetail(selectedPid);
    } else {
      setProcessDetail(null);
    }
  }, [selectedPid, fetchProcessDetail]);

  // Filter and sort ports
  const filteredPorts = useMemo(() => {
    if (!data?.ports) return [];

    let result = [...data.ports];

    // Apply type filter
    switch (filter) {
      case "tcp":
        result = result.filter((p) => p.protocol === "tcp");
        break;
      case "udp":
        result = result.filter((p) => p.protocol === "udp");
        break;
      case "listening":
        result = result.filter((p) => p.state === "LISTEN");
        break;
      case "established":
        result = result.filter((p) => p.state === "ESTAB");
        break;
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.localPort.toString().includes(term) ||
          p.localAddress.toLowerCase().includes(term) ||
          (p.processName?.toLowerCase().includes(term) ?? false) ||
          (p.pid?.toString().includes(term) ?? false)
      );
    }

    // Apply sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "port":
          cmp = a.localPort - b.localPort;
          break;
        case "protocol":
          cmp = a.protocol.localeCompare(b.protocol);
          break;
        case "state":
          cmp = a.state.localeCompare(b.state);
          break;
        case "process":
          cmp = (a.processName || "").localeCompare(b.processName || "");
          break;
        case "pid":
          cmp = (a.pid || 0) - (b.pid || 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, filter, searchTerm, sortField, sortDir]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Sort indicator
  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  // Get state color class
  const getStateClass = (state: string) => {
    switch (state) {
      case "LISTEN":
        return styles.stateListen;
      case "ESTAB":
        return styles.stateEstablished;
      case "TIME-WAIT":
        return styles.stateTimeWait;
      case "CLOSE-WAIT":
        return styles.stateCloseWait;
      default:
        return "";
    }
  };

  return (
    <>
      <button type="button" className={menuStyles.item} onClick={() => setIsOpen(true)}>
        <span className={menuStyles.menuIcon}>🔌</span>
        <span>Port Usage</span>
      </button>

      {isOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
          role="button"
          tabIndex={0}
        >
          <div
            className={styles.popup}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
          >
            {/* Header */}
            <div className={styles.header}>
              <span className={styles.title}>Port Usage</span>
              <div className={styles.stats}>
                {data && (
                  <>
                    <span>Total:{data.stats.total}</span>
                    <span className={styles.tcpBadge}>TCP:{data.stats.tcp}</span>
                    <span className={styles.udpBadge}>UDP:{data.stats.udp}</span>
                    <span className={styles.listenBadge}>L:{data.stats.listening}</span>
                    <span className={styles.estabBadge}>E:{data.stats.established}</span>
                  </>
                )}
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
              {/* Filter buttons */}
              <div className={styles.filterGroup}>
                {(["all", "tcp", "udp", "listening", "established"] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search port, address, process..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Refresh */}
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={fetchData}
                disabled={isLoading}
              >
                {isLoading ? "⏳" : "🔄"}
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              {/* Header Row */}
              <div className={styles.headerRow}>
                <button
                  type="button"
                  className={styles.colProtocol}
                  onClick={() => handleSort("protocol")}
                >
                  Proto {sortIndicator("protocol")}
                </button>
                <button
                  type="button"
                  className={styles.colState}
                  onClick={() => handleSort("state")}
                >
                  State {sortIndicator("state")}
                </button>
                <button type="button" className={styles.colPort} onClick={() => handleSort("port")}>
                  Port {sortIndicator("port")}
                </button>
                <span className={styles.colAddress}>Local Address</span>
                <button type="button" className={styles.colPid} onClick={() => handleSort("pid")}>
                  PID {sortIndicator("pid")}
                </button>
                <button
                  type="button"
                  className={styles.colProcess}
                  onClick={() => handleSort("process")}
                >
                  Process {sortIndicator("process")}
                </button>
              </div>

              {/* Port List */}
              <div className={styles.portList}>
                {filteredPorts.length === 0 ? (
                  <div className={styles.emptyState}>
                    {isLoading ? "Loading..." : "No ports found"}
                  </div>
                ) : (
                  filteredPorts.map((port) => (
                    <div
                      key={`${port.protocol}-${port.localAddress}-${port.localPort}-${port.pid || "nopid"}`}
                      className={`${styles.portRow} ${selectedPid && port.pid === selectedPid ? styles.selected : ""}`}
                      onClick={() => (port.pid ? setSelectedPid(port.pid) : setSelectedPid(null))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          port.pid ? setSelectedPid(port.pid) : setSelectedPid(null);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span
                        className={`${styles.colProtocol} ${port.protocol === "tcp" ? styles.protoTcp : styles.protoUdp}`}
                      >
                        {port.protocol.toUpperCase()}
                      </span>
                      <span className={`${styles.colState} ${getStateClass(port.state)}`}>
                        {port.state}
                      </span>
                      <span className={styles.colPort}>{port.localPort}</span>
                      <span className={styles.colAddress}>{port.localAddress}</span>
                      <span className={styles.colPid}>{port.pid ?? "-"}</span>
                      <span className={styles.colProcess} title={port.processName || undefined}>
                        {port.processName || "-"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Selected Process Details */}
              {selectedPid && processDetail && (
                <div className={styles.detailsPanel}>
                  <div className={styles.detailsHeader}>
                    <span>
                      PID: {selectedPid} — {processDetail.name}
                    </span>
                    <button type="button" onClick={() => setSelectedPid(null)}>
                      ✕
                    </button>
                  </div>
                  <div className={styles.detailsBody}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Command:</span>
                      <span className={styles.detailValue}>{processDetail.command}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>User:</span>
                      <span className={styles.detailValue}>{processDetail.user}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>CPU:</span>
                      <span className={styles.detailValue}>{processDetail.cpu}%</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Memory:</span>
                      <span className={styles.detailValue}>{processDetail.mem}%</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Start:</span>
                      <span className={styles.detailValue}>{processDetail.startTime}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
