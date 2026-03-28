/**
 * MessageSearch - 消息搜索组件
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchStore } from '../../store/searchStore';
import { useChatStore } from '../../store/chatStore';
import styles from './MessageSearch.module.css';

export function MessageSearch() {
  const {
    query,
    results,
    currentIndex,
    filters,
    setQuery,
    setFilters,
    setResults,
    nextResult,
    prevResult,
    clearSearch
  } = useSearchStore();

  const { messages } = useChatStore();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Perform search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const searchResults = messages
      .filter(msg => {
        // Apply filters
        if (msg.role === 'user' && !filters.user) return false;
        if (msg.role === 'assistant' && !filters.assistant) return false;
        // Check thinking and tools in content
        const hasThinking = msg.content.some(c => c.type === 'thinking');
        const hasTools = msg.content.some(c => c.type === 'tool');
        if (hasThinking && !filters.thinking) return false;
        if (hasTools && !filters.tools) return false;
        return true;
      })
      .map(msg => {
        const text = msg.content.map(c => c.text || c.thinking || '').join(' ');
        const regex = new RegExp(escapeRegex(debouncedQuery), 'gi');
        const matches = text.match(regex);
        
        if (!matches || matches.length === 0) return null;

        // Get preview around first match
        const matchIndex = text.toLowerCase().indexOf(debouncedQuery.toLowerCase());
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(text.length, matchIndex + debouncedQuery.length + 50);
        const preview = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');

        return {
          messageId: msg.id,
          indices: matches.map((_, i) => {
            let pos = 0;
            for (let j = 0; j < i; j++) {
              pos = text.toLowerCase().indexOf(debouncedQuery.toLowerCase(), pos) + 1;
            }
            return text.toLowerCase().indexOf(debouncedQuery.toLowerCase(), pos);
          }),
          preview
        };
      })
      .filter(Boolean) as any[];

    setResults(searchResults);
  }, [debouncedQuery, messages, filters, setResults]);

  const handleClear = () => {
    clearSearch();
    // Remove all highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Search Messages</span>
        <button className={styles.clearBtn} onClick={handleClear} title="Clear Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className={styles.inputWrapper}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          className={styles.input}
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <div className={styles.stats}>
          {currentIndex + 1} / {results.length}
          <button onClick={prevResult}>↑</button>
          <button onClick={nextResult}>↓</button>
        </div>
      )}

      <div className={styles.filters}>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={filters.user}
            onChange={(e) => setFilters({ user: e.target.checked })}
          />
          User
        </label>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={filters.assistant}
            onChange={(e) => setFilters({ assistant: e.target.checked })}
          />
          Assistant
        </label>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={filters.thinking}
            onChange={(e) => setFilters({ thinking: e.target.checked })}
          />
          Thinking
        </label>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={filters.tools}
            onChange={(e) => setFilters({ tools: e.target.checked })}
          />
          Tools
        </label>
      </div>
    </div>
  );
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
