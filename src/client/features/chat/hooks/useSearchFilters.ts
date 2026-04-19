/**
 * useSearchFilters - Search过滤逻辑 Hook
 *
 * Responsibilities:
 * - 管理Search查询和过滤器状态
 * - 处理Search查询变化
 * - 处理过滤器变化
 */

import { useCallback, useState } from "react";

export interface SearchFilters {
  user: boolean;
  assistant: boolean;
  thinking: boolean;
  tools: boolean;
}

export interface UseSearchFiltersReturn {
  // 状态
  query: string;
  filters: SearchFilters;
  showFilterPanel: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Actions
  setQuery: (query: string) => void;
  clearQuery: () => void;
  toggleFilter: (key: keyof SearchFilters) => void;
  setFilter: (key: keyof SearchFilters, value: boolean) => void;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  toggleFilterPanel: () => void;
  resetFilters: () => void;
}

interface UseSearchFiltersOptions {
  externalQuery?: string;
  externalFilters?: SearchFilters;
  onQueryChange?: (query: string) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  user: true,
  assistant: true,
  thinking: true,
  tools: true,
};

export function useSearchFilters(options: UseSearchFiltersOptions = {}): UseSearchFiltersReturn {
  const { externalQuery, externalFilters, onQueryChange, onFiltersChange } = options;

  // 内部状态（如果没有外部控制）
  const [internalQuery, setInternalQuery] = useState("");
  const [internalFilters, setInternalFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // 使用外部或内部状态
  const query = externalQuery ?? internalQuery;
  const filters = externalFilters ?? internalFilters;

  // 计算活跃过滤器
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // 设置查询
  const setQuery = useCallback(
    (newQuery: string) => {
      if (onQueryChange) {
        onQueryChange(newQuery);
      } else {
        setInternalQuery(newQuery);
      }
    },
    [onQueryChange]
  );

  // 清空查询
  const clearQuery = useCallback(() => {
    setQuery("");
  }, [setQuery]);

  // 切换过滤器
  const toggleFilter = useCallback(
    (key: keyof SearchFilters) => {
      const newFilters = { ...filters, [key]: !filters[key] };
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      } else {
        setInternalFilters(newFilters);
      }
    },
    [filters, onFiltersChange]
  );

  // 设置过滤器
  const setFilter = useCallback(
    (key: keyof SearchFilters, value: boolean) => {
      const newFilters = { ...filters, [key]: value };
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      } else {
        setInternalFilters(newFilters);
      }
    },
    [filters, onFiltersChange]
  );

  // 过滤器面板控制
  const openFilterPanel = useCallback(() => setShowFilterPanel(true), []);
  const closeFilterPanel = useCallback(() => setShowFilterPanel(false), []);
  const toggleFilterPanel = useCallback(() => setShowFilterPanel((prev) => !prev), []);

  // 重置过滤器
  const resetFilters = useCallback(() => {
    if (onFiltersChange) {
      onFiltersChange(DEFAULT_FILTERS);
    } else {
      setInternalFilters(DEFAULT_FILTERS);
    }
  }, [onFiltersChange]);

  return {
    query,
    filters,
    showFilterPanel,
    hasActiveFilters,
    activeFilterCount,
    setQuery,
    clearQuery,
    toggleFilter,
    setFilter,
    openFilterPanel,
    closeFilterPanel,
    toggleFilterPanel,
    resetFilters,
  };
}
