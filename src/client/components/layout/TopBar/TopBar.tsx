/**
 * TopBar - Compact Header with Integrated Search
 */

import { useCallback, useState } from 'react';
import { useSessionStore } from '../../../store/sessionStore';
import { useModalStore } from '../../../store/modalStore';
import { useChatStore } from '../../../store/chatStore';
import { useSidebarStore } from '../../../store/sidebarStore';
import { useSidebarController } from '../../../api/sidebarApi';
import styles from './TopBar.module.css';

// Available models
const MODELS = [
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
];

// Thinking levels
const THINKING_LEVELS = [
  { id: 'none', name: 'None', description: 'No thinking' },
  { id: 'low', name: 'Low', description: 'Minimal thinking' },
  { id: 'medium', name: 'Medium', description: 'Balanced' },
  { id: 'high', name: 'High', description: 'Deep thinking' },
];

interface TopBarProps {
  workingDir: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  pid: number | null;
}

export function TopBar({ workingDir, connectionStatus, pid }: TopBarProps) {
  const { currentModel, thinkingLevel } = useSessionStore();
  const { openSystemPrompt, openModelSelector, openThinkingLevel } = useModalStore();
  const { isStreaming } = useChatStore();
  
  // Search state from sidebar store
  const searchQuery = useSidebarStore((state) => state.searchQuery);
  const filters = useSidebarStore((state) => state.searchFilters);
  const sidebarController = useSidebarController();
  const [showFilters, setShowFilters] = useState(false);

  const currentModelName = MODELS.find(m => m.id === currentModel)?.name.split(' ')[0] || 'Model';
  const currentThinkingName = THINKING_LEVELS.find(t => t.id === thinkingLevel)?.name || 'Med';

  const handleFilterChange = (key: keyof typeof filters) => {
    sidebarController.setSearchFilters({ [key]: !filters[key] });
  };

  const hasActiveFilters = filters.user || filters.assistant || filters.thinking || filters.tools;
  const activeFilterCount = [filters.user, filters.assistant, filters.thinking, filters.tools].filter(Boolean).length;

  return (
    <header className={styles.topBar}>
      {/* Left: System Prompt */}
      <button
        className={styles.iconBtn}
        onClick={openSystemPrompt}
        title="System Prompt"
      >
        <DocumentIcon />
      </button>

      {/* Center: Search */}
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <SearchIcon className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => sidebarController.setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className={styles.clearBtn}
              onClick={() => sidebarController.setSearchQuery('')}
              title="Clear"
            >
              <XIcon />
            </button>
          )}
          <button 
            className={`${styles.filterToggle} ${hasActiveFilters ? styles.active : ''} ${showFilters ? styles.expanded : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle Filters"
          >
            <FilterIcon />
            {hasActiveFilters && <span className={styles.filterCount}>{activeFilterCount}</span>}
          </button>
        </div>
        
        {/* Filter dropdown */}
        {showFilters && (
          <div className={styles.filterDropdown}>
            <FilterChip label="User" checked={filters.user} onChange={() => handleFilterChange('user')} />
            <FilterChip label="Assistant" checked={filters.assistant} onChange={() => handleFilterChange('assistant')} />
            <FilterChip label="Thinking" checked={filters.thinking} onChange={() => handleFilterChange('thinking')} />
            <FilterChip label="Tools" checked={filters.tools} onChange={() => handleFilterChange('tools')} />
          </div>
        )}
      </div>

      {/* Right: Model, Thinking, Status */}
      <div className={styles.rightSection}>
        <button
          className={styles.selector}
          onClick={openModelSelector}
          disabled={isStreaming}
          title="Model"
        >
          <ModelIcon />
          <span>{currentModelName}</span>
        </button>

        <button
          className={styles.selector}
          onClick={openThinkingLevel}
          disabled={isStreaming}
          title="Thinking"
        >
          <ThinkingIcon />
          <span>{currentThinkingName}</span>
        </button>

        <div className={styles.status} title={`Status: ${connectionStatus}`}>
          <span className={`${styles.statusDot} ${styles[connectionStatus]}`} />
          {pid && <span className={styles.pid}>{pid}</span>}
        </div>
      </div>
    </header>
  );
}

// Filter Chip Component
function FilterChip({ 
  label, 
  checked, 
  onChange 
}: { 
  label: string; 
  checked: boolean; 
  onChange: () => void;
}) {
  return (
    <button 
      className={`${styles.filterChip} ${checked ? styles.checked : ''}`}
      onClick={onChange}
    >
      {checked && <CheckIcon />}
      <span>{label}</span>
    </button>
  );
}

// Icons
function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function ThinkingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
