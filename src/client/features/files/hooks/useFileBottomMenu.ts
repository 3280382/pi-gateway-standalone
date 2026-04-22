/**
 * useFileBottomMenu - files底部菜单业务逻辑 Hook
 *
 * Responsibilities:管理底部菜单的所有业务逻辑
 * - 新建files
 * - Delete files
 * - 树状视图
 */

import { useCallback, useEffect, useState } from "react";
import type { TreeResponse } from "@/features/files/types";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useFileOperations } from "./useFileOperations";

export type NewItemType = "file" | "directory";

export interface UseFileBottomMenuResult {
  // UI 状态
  isNewModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isTreeModalOpen: boolean;
  newFileName: string;
  newItemType: NewItemType;
  treeData: TreeResponse | null;
  treeLoading: boolean;

  // 状态设置
  setNewFileName: (name: string) => void;
  setNewItemType: (type: NewItemType) => void;

  // Actions方法
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
  const [newItemType, setNewItemType] = useState<NewItemType>("file");
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(false);

  // Domain 状态
  const { selectedItems, isMultiSelectMode, toggleMultiSelectMode, clearSelection } =
    useFileStore();
  const { currentPath } = useWorkspaceStore();

  const { createNewFile, createNewDirectory, deleteSelected } = useFileOperations();
  const { openViewer } = useFileViewerStore();

  // ========== 2. Ref ==========
  // 无直接DOM引用

  const handleCloseTree = useCallback(() => {
    setIsTreeModalOpen(false);
    setTreeData(null);
  }, []);

  // ========== 3. Effects ==========
  // ESC Close树状视图
  useEffect(() => {
    if (!isTreeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseTree();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isTreeModalOpen, handleCloseTree]);

  // ========== 4. Computed ==========
  // 简单Items件判断，无需useMemo

  // ========== 5. Actions ==========
  // 新建files/directories
  const handleNewClick = useCallback(() => {
    setIsNewModalOpen(true);
    setNewFileName("");
    setNewItemType("file");
  }, []);

  const handleConfirmNew = useCallback(async () => {
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    if (newItemType === "file") {
      await createNewFile(name);
    } else {
      await createNewDirectory(name);
    }
    setIsNewModalOpen(false);
    setNewFileName("");
  }, [newFileName, newItemType, createNewFile, createNewDirectory]);

  const handleCancelNew = useCallback(() => {
    setIsNewModalOpen(false);
    setNewFileName("");
  }, []);

  // Delete files
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
      const data = await fileApi.tree(currentPath);
      setTreeData(data);
    } catch (error) {
      console.error("[TreeView] Failed to load file tree:", error);
    } finally {
      setIsTreeLoading(false);
    }
  }, [currentPath]);

  const handleTreeFileClick = useCallback(
    (filePath: string, fileName: string) => {
      const fullPath = currentPath ? `${currentPath}/${filePath}` : filePath;
      openViewer(fullPath, fileName, "view");
    },
    [currentPath, openViewer]
  );

  // ========== 6. Return ==========
  return {
    isNewModalOpen,
    isDeleteModalOpen,
    isTreeModalOpen,
    newFileName,
    newItemType,
    treeData,
    treeLoading: isTreeLoading,
    setNewFileName,
    setNewItemType,
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
