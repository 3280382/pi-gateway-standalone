/**
 * LlmLogModal - LLM日志查看器
 */

import { useEffect, useState, useCallback } from 'react';
import { useModalStore } from '../../store/modalStore';
import { useLlmLogStore } from '../../store/llmLogStore';
import styles from './Modals.module.css';

interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  requestBody?: string;
  responseBody?: string;
}

export function LlmLogModal() {
  const { isLlmLogOpen, closeLlmLog } = useModalStore();
  const { enabled, refreshInterval, truncate, truncateSize, setEnabled, setRefreshInterval, setTruncate, setTruncateSize } = useLlmLogStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/llm-log');
      const data = await res.json();
      setLogs(data.entries || []);
    } catch (err) {
      console.error('Failed to load LLM logs:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Auto refresh
  useEffect(() => {
    if (!isLlmLogOpen || !enabled) return;

    loadLogs();
    const timer = setInterval(loadLogs, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [isLlmLogOpen, enabled, refreshInterval, loadLogs]);

  if (!isLlmLogOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeLlmLog}>
      <div className={`${styles.modal} ${styles.large}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>LLM Model Log</h3>
          <div className={styles.headerActions}>
            <span className={styles.status}>Auto-refresh: {enabled ? 'ON' : 'OFF'}</span>
            <button className={styles.actionBtn} onClick={loadLogs} title="Refresh Now">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button className={styles.closeBtn} onClick={closeLlmLog}>✕</button>
          </div>
        </div>

        <div className={styles.settings}>
          <label>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Record LLM Model Log
          </label>
          <label>
            Refresh Interval (seconds)
            <input
              type="number"
              min={1}
              max={60}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
              disabled={!enabled}
            />
          </label>
          <label>
            <input type="checkbox" checked={truncate} onChange={(e) => setTruncate(e.target.checked)} />
            Truncate Log Content
          </label>
          {truncate && (
            <label>
              Max Characters
              <input
                type="number"
                min={100}
                max={50000}
                step={100}
                value={truncateSize}
                onChange={(e) => setTruncateSize(parseInt(e.target.value) || 5000)}
              />
            </label>
          )}
        </div>

        <div className={`${styles.content} ${styles.scrollable}`}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : logs.length === 0 ? (
            <div className={styles.empty}>No logs recorded</div>
          ) : (
            <div className={styles.logList}>
              {logs.map((log, i) => (
                <details key={i} className={styles.logEntry}>
                  <summary>
                    <span className={styles.timestamp}>{log.timestamp}</span>
                    <span className={styles.method}>{log.method}</span>
                    <span className={styles.url}>{log.url}</span>
                  </summary>
                  <div className={styles.logDetails}>
                    {log.requestBody && (
                      <div>
                        <h5>Request</h5>
                        <pre className={styles.code}>
                          {truncate ? log.requestBody.slice(0, truncateSize) : log.requestBody}
                        </pre>
                      </div>
                    )}
                    {log.responseBody && (
                      <div>
                        <h5>Response</h5>
                        <pre className={styles.code}>
                          {truncate ? log.responseBody.slice(0, truncateSize) : log.responseBody}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
