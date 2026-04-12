/**
 * useFileBottomMenu - 文件底部菜单业务逻辑 Hook
 *
 * 职责：管理底部菜单的所有业务逻辑
 * - 新建文件
 * - 删除文件
 * - 树状视图
 */

import { useCallback, useEffect, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import type { TreeResponse } from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { useFileOperations } from "./useFileOperations";

export interface UseFileBottomMenuResult {
  // UI 状态
  isNewModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isTreeModalOpen: boolean;
  newFileName: string;
  treeData: TreeResponse | null;
  treeLoading: boolean;

  // 状态设置
  setNewFileName: (name: string) => void;

  // 操作方法
  handleNewClick: () => void;
  handleConfirmNew: () => Promise<void>;
  handleCancelNew: () => void;
  handleDeleteClick: () => void;
  handleConfirmDelete: () => Promise<void>;
  handleCancelDelete: () => void;
  handleTreeClick: () => Promise<void>;
  handleTreeFileClick: (filePath: string, fileName: string) => void;
  handleCloseTree: () => void;
}

export function useFileBottomMenu(): UseFileBottomMenuResult {
  // ========== 1. State ==========
  // UI 状态
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);

  // Domain 状态
  const { selectedItems, isMultiSelectMode, toggleMultiSelectMode, clearSelection, workingDir } =
    useFileStore();

  const { createNewFile, deleteSelected } = useFileOperations();
  const { openViewer } = useFileViewerStore();

  // ========== 2. Ref ==========
  // 无直接DOM引用

  const handleCloseTree = useCallback(() => {
    setIsTreeModalOpen(false);
    setTreeData(null);
  }, []);

  // ========== 3. Effects ==========
  // ESC 关闭树状视图
  useEffect(() => {
    if (!isTreeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseTree();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isTreeModalOpen, handleCloseTree]);

  // ========== 4. Computed ==========
  // 简单条件判断，无需useMemo

  // ========== 5. Actions ==========
  // 新建文件
  const handleNewClick = useCallback(() => {
    setIsNewModalOpen(true);
    setNewFileName("");
  }, []);

  const handleConfirmNew = useCallback(async () => {
    if (!newFileName.trim()) return;
    const fileName = newFileName.trim();
    await createNewFile(fileName);
    setIsNewModalOpen(false);
    setNewFileName("");
  }, [newFileName, createNewFile]);

  const handleCancelNew = useCallback(() => {
    setIsNewModalOpen(false);
    setNewFileName("");
  }, []);

  // 删除文件
  const handleDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      if (!isMultiSelectMode) {
        toggleMultiSelectMode();
      }
      return;
    }
    setIsDeleteModalOpen(true);
  }, [selectedItems.length, isMultiSelectMode, toggleMultiSelectMode]);

  const handleConfirmDelete = useCallback(async () => {
    await deleteSelected();
    setIsDeleteModalOpen(false);
    clearSelection();
    if (isMultiSelectMode) {
      toggleMultiSelectMode();
    }
  }, [deleteSelected, clearSelection, isMultiSelectMode, toggleMultiSelectMode]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  // 树状视图
  const handleTreeClick = useCallback(async () => {
    setIsTreeModalOpen(true);
    setIsTreeLoading(true);
    try {
      const data = await fileApi.tree(workingDir);
      setTreeData(data);
    } catch (error) {
      console.error("[TreeView] Failed to load file tree:", error);
    } finally {
      setIsTreeLoading(false);
    }
  }, [workingDir]);

  const handleTreeFileClick = useCallback(
    (filePath: string, fileName: string) => {
      const fullPath = workingDir ? `${workingDir}/${filePath}` : filePath;
      openViewer(fullPath, fileName, "view");
    },
    [workingDir, openViewer]
  );

  // ========== 6. Return ==========
  return {
    isNewModalOpen,
    isDeleteModalOpen,
    isTreeModalOpen,
    newFileName,
    treeData,
    treeLoading: isTreeLoading,
    setNewFileName,
    handleNewClick,
    handleConfirmNew,
    handleCancelNew,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleTreeClick,
    handleTreeFileClick,
    handleCloseTree,
  };
}
