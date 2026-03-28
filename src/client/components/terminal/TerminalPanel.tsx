/**
 * TerminalPanel - Xterm.js terminal for file operations
 */

import { useEffect, useRef, useState } from 'react';
import styles from './TerminalPanel.module.css';

interface TerminalPanelProps {
  height: number;
  onClose: () => void;
  onHeightChange: (height: number) => void;
  output?: string;
}

export function TerminalPanel({ height, onClose, onHeightChange, output }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(height);

  // Terminal content
  const [lines, setLines] = useState<string[]>([
    '$ pi-mono on main via node v20.15.0',
    '$',
  ]);

  // Add output when it changes
  useEffect(() => {
    if (output) {
      const outputLines = output.split('\n').filter(line => line.trim() !== '');
      setLines(prev => [...prev.slice(0, -1), ...outputLines, '$']);
    }
  }, [output]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // In real implementation, initialize xterm.js here
    // const term = new Terminal({ ... });
    // term.open(terminalRef.current);
  }, []);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(500, resizeStartHeight.current + delta));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onHeightChange]);

  return (
    <div 
      className={styles.panel}
      style={{ height: `${height}px` }}
    >
      {/* Resize handle */}
      <div 
        className={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      >
        <div className={styles.resizeGrip} />
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <TerminalIcon />
          <span>Terminal</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => setLines(['$'])} title="Clear">
            <ClearIcon />
          </button>
          <button className={styles.actionBtn} onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className={styles.terminal}>
        {lines.map((line, i) => (
          <div key={i} className={styles.line}>
            <span className={styles.prompt}>{line.startsWith('$') ? '$' : ''}</span>
            <span className={styles.text}>{line.replace(/^\$\s*/, '')}</span>
          </div>
        ))}
        <div className={styles.line}>
          <span className={styles.prompt}>$</span>
          <span className={styles.cursor}>█</span>
        </div>
      </div>
    </div>
  );
}

// Terminal Icon
function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

// Clear Icon
function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// Close Icon
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
