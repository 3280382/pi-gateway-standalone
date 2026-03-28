/**
 * BottomMenu - Layout with left-aligned toggles, center content
 */

import styles from './BottomMenu.module.css';

interface BottomMenuProps {
  isSidebarVisible: boolean;
  currentView: 'chat' | 'files';
  isBottomPanelVisible?: boolean;
  onToggleSidebar: () => void;
  onSwitchView: (view: 'chat' | 'files') => void;
  onToggleBottomPanel?: () => void;
}

export function BottomMenu({
  isSidebarVisible,
  currentView,
  isBottomPanelVisible,
  onToggleSidebar,
  onSwitchView,
  onToggleBottomPanel,
}: BottomMenuProps) {
  return (
    <nav className={styles.bottomMenu}>
      {/* Left: Toggle buttons (fixed position) */}
      <div className={styles.leftGroup}>
        <button
          className={`${styles.menuButton} ${isSidebarVisible ? styles.active : ''}`}
          onClick={onToggleSidebar}
          title={isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {isSidebarVisible ? <LeftArrowIcon /> : <RightArrowIcon />}
        </button>

        {onToggleBottomPanel && (
          <button
            className={`${styles.menuButton} ${isBottomPanelVisible ? styles.active : ''}`}
            onClick={onToggleBottomPanel}
            title={isBottomPanelVisible ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
          >
            {isBottomPanelVisible ? <DownArrowIcon /> : <UpArrowIcon />}
          </button>
        )}
      </div>

      {/* Center: View switchers */}
      <div className={styles.centerGroup}>
        <button
          className={`${styles.menuButton} ${currentView === 'chat' ? styles.active : ''}`}
          onClick={() => onSwitchView('chat')}
          title="Chat"
        >
          <ChatIcon />
        </button>

        <button
          className={`${styles.menuButton} ${currentView === 'files' ? styles.active : ''}`}
          onClick={() => onSwitchView('files')}
          title="Files"
        >
          <FilesIcon />
        </button>
      </div>
    </nav>
  );
}

// Left Arrow Icon (thicker)
function LeftArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

// Right Arrow Icon (thicker)
function RightArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

// Up Arrow Icon (thicker)
function UpArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

// Down Arrow Icon (thicker)
function DownArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

// Chat Icon (bubble)
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// Files Icon (folder)
function FilesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
