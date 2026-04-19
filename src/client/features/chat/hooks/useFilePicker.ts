/**
 * useFilePicker - @mention files选择逻辑 Hook
 *
 * Responsibilities:
 * - 管理 @mention files选择器的状态
 * - 加载files列表
 * - 过滤files
 * - 处理files选择
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface UseFilePickerReturn {
  // 状态
  isOpen: boolean;
  filter: string;
  fileList: FileItem[];
  isLoading: boolean;
  selectedIndex: number;
  filteredFiles: FileItem[];

  // Actions
  open: (triggerAtEnd?: boolean) => Promise<void>;
  close: () => void;
  setFilter: (filter: string) => void;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  selectFile: (file: FileItem) => void;
  moveSelection: (direction: "up" | "down") => void;
  refreshFileList: () => Promise<void>;
}

interface UseFilePickerOptions {
  value: string;
  onChange: (newValue: string) => void;
  onFocusInput?: () => void;
}

export function useFilePicker(options: UseFilePickerOptions): UseFilePickerReturn {
  const { value, onChange, onFocusInput } = options;
  // 使用全局 workspaceStore 的 workingDir
  const workingDir = useWorkspaceStore((state) => state.workingDir);

  // 状态
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 加载files列表
  const loadFileList = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fileApi.browse(workingDir);
      const   items: FileItem[] = [
        ...(data.parentPath !== data.workingDir
          ? [{ name: "..", path: data.parentPath, isDirectory: true }]
          : []),
        ...data.  items,
      ];
      setFileList(  items);
    } catch (err) {
      console.error("[useFilePicker] Failed to load files:", err);
      setFileList([]);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  // 过滤files列表
  const filteredFiles = useMemo(() => {
    if (!filter) return fileList;
    const lowerFilter = filter.toLowerCase();
    return fileList.filter(
      (f) =>
        f.name.toLowerCase().includes(lowerFilter) || f.path.toLowerCase().includes(lowerFilter)
    );
  }, [filter, fileList]);

  // 检测 @mention 触发
  useEffect(() => {
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      // Show picker when @ is at word boundary (start of input, after space, or after newline)
      if (!afterAt.includes(" ")) {
        setFilter(afterAt.toLowerCase());
        setIsOpen(true);
        setSelectedIndex(0);
        loadFileList();
        return;
      }
    }
    setIsOpen(false);
  }, [value, loadFileList]);

  // 打开files选择器
  const open = useCallback(
    async (triggerAtEnd = true) => {
      if (triggerAtEnd) {
        const newValue = `${value}@`;
        onChange(newValue);
      }
      setFilter("");
      setSelectedIndex(0);
      await loadFileList();
      setIsOpen(true);
      onFocusInput?.();
    },
    [value, onChange, loadFileList, onFocusInput]
  );

  // Closefiles选择器
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 选择files
  const selectFile = useCallback(
    (file: FileItem) => {
      const lastAtIndex = value.lastIndexOf("@");
      const beforeAt = value.slice(0, lastAtIndex);
      const afterAt = value.slice(lastAtIndex + 1 + filter.length);
      const filePath = file.isDirectory ? `${file.path}/` : file.path;
      onChange(`${beforeAt}${filePath}${afterAt}`);
      setIsOpen(false);
      onFocusInput?.();
    },
    [value, filter, onChange, onFocusInput]
  );

  // 移动选择
  const moveSelection = useCallback(
    (direction: "up" | "down") => {
      if (filteredFiles.length === 0) return;
      if (direction === "down") {
        setSelectedIndex((prev) => (prev + 1) % filteredFiles.length);
      } else {
        setSelectedIndex((prev) => (prev <= 0 ? filteredFiles.length - 1 : prev - 1));
      }
    },
    [filteredFiles.length]
  );

  // Refreshfiles列表
  const refreshFileList = useCallback(async () => {
    await loadFileList();
  }, [loadFileList]);

  return {
    isOpen,
    filter,
    fileList,
    isLoading,
    selectedIndex,
    filteredFiles,
    open,
    close,
    setFilter,
    setSelectedIndex,
    selectFile,
    moveSelection,
    refreshFileList,
  };
}
