/**
 * useDirectoryPicker - directories选择器逻辑 Hook
 *
 * Responsibilities:
 * - 管理directories选择器状态
 * - 加载directoriesCols表
 * - 处理directories选择
 */

import { useCallback, useState } from "react";

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface UseDirectoryPickerReturn {
  // 状态
  isOpen: boolean;
  currentPath: string;
  entries: DirectoryEntry[];
  isLoading: boolean;

  // Actions
  open: (initialPath?: string) => void;
  close: () => void;
  loadDirectory: (path: string) => Promise<void>;
  selectDirectory: (path: string) => void;
  navigateToParent: () => void;
}

interface UseDirectoryPickerOptions {
  onSelect: (path: string) => void;
}

export function useDirectoryPicker(options: UseDirectoryPickerOptions): UseDirectoryPickerReturn {
  const { onSelect } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("/root");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载directories
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/files/file/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await response.json();

      const dirs = data.items
        .filter((item: any) => item.isDirectory)
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          isDirectory: true,
        }));

      if (data.parentPath !== data.currentPath) {
        dirs.unshift({
          name: "..",
          path: data.parentPath,
          isDirectory: true,
        });
      }

      setEntries(dirs);
      setCurrentPath(data.currentPath);
    } catch (error) {
      console.error("[useDirectoryPicker] Failed to load directory:", error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 打开选择器
  const open = useCallback(
    (initialPath?: string) => {
      const path = initialPath || currentPath;
      setIsOpen(true);
      loadDirectory(path);
    },
    [currentPath, loadDirectory]
  );

  // Close选择器
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 选择directories
  const selectDirectory = useCallback(
    (path: string) => {
      onSelect(path);
      close();
    },
    [onSelect, close]
  );

  // Navigation到上级directories
  const navigateToParent = useCallback(() => {
    // 从 entries 中找到 .. 项
    const parentEntry = entries.find((e) => e.name === "..");
    if (parentEntry) {
      loadDirectory(parentEntry.path);
    }
  }, [entries, loadDirectory]);

  return {
    isOpen,
    currentPath,
    entries,
    isLoading,
    open,
    close,
    loadDirectory,
    selectDirectory,
    navigateToParent,
  };
}
