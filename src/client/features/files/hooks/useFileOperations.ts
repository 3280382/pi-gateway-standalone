/**
 * useFileOperations - files操作逻辑 Hook
 *
 * Responsibilities:封装files增删改查的业务逻辑
 * - 批量删除
 * - 批量移动
 * - 创建files
 * - 执行files
 */

import { useCallback } from "react";
import * as fileOperationsApi from "@/features/files/services/api/fileOperationsApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { fileBrowserDebug } from "@/lib/debug";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface UseFileOperationsResult {
  deleteSelected: () => Promise<void>;
  moveSelected: (targetPath: string) => Promise<void>;
  createNewFile: (fileName: string) => Promise<void>;
  executeFile: (path: string, onOutput?: (output: string) => void) => Promise<string | undefined>;
  refreshAfterOperation: () => Promise<void>;
}

export function useFileOperations(): UseFileOperationsResult {
  const {
    selectedItems,
    currentBrowsePath,
    setItems,
    setCurrentBrowsePath,
    setParentPath,
    setError,
    setSelectedItems,
    setIsMultiSelectMode,
  } = useFileStore();

  const { workingDir } = useWorkspaceStore();

  /**
   * 操作后刷新directories
   */
  const refreshAfterOperation = useCallback(async () => {
    try {
      const data = await fileOperationsApi.loadDirectoryContent(currentBrowsePath);
      setItems(data.items);
      setCurrentBrowsePath(data.workingDir);
      setParentPath(data.parentPath);
    } catch (error) {
      fileBrowserDebug.error("刷新directories失败", { error });
      setError("Failed to refresh directory");
    }
  }, [currentBrowsePath, setItems, setCurrentBrowsePath, setParentPath, setError]);

  /**
   * 批量删除选中的files
   */
  const deleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;

    try {
      fileBrowserDebug.info("批量删除files", { paths: selectedItems });
      await fileOperationsApi.batchDeleteFiles(selectedItems);

      // 刷新directories
      await refreshAfterOperation();

      // 清除选择
      setSelectedItems([]);
      setIsMultiSelectMode(false);

      fileBrowserDebug.info("批量删除成功");
    } catch (error) {
      fileBrowserDebug.error("批量删除失败", { error });
      setError("Failed to delete selected files");
      throw error;
    }
  }, [selectedItems, refreshAfterOperation, setSelectedItems, setIsMultiSelectMode, setError]);

  /**
   * 批量移动选中的files
   */
  const moveSelected = useCallback(
    async (targetPath: string) => {
      if (selectedItems.length === 0) return;

      try {
        fileBrowserDebug.info("批量移动files", {
          paths: selectedItems,
          targetPath,
        });
        await fileOperationsApi.batchMoveFiles(selectedItems, targetPath);

        // 刷新directories
        await refreshAfterOperation();

        // 清除选择
        setSelectedItems([]);
        setIsMultiSelectMode(false);

        fileBrowserDebug.info("批量移动成功");
      } catch (error) {
        fileBrowserDebug.error("批量移动失败", { error });
        setError("Failed to move selected files");
        throw error;
      }
    },
    [selectedItems, refreshAfterOperation, setSelectedItems, setIsMultiSelectMode, setError]
  );

  /**
   * 创建新files
   */
  const createNewFile = useCallback(
    async (fileName: string) => {
      try {
        fileBrowserDebug.info("创建新files", { fileName, currentBrowsePath });
        await fileOperationsApi.createFile(currentBrowsePath, fileName);

        // 刷新directories
        await refreshAfterOperation();

        fileBrowserDebug.info("创建files成功", { fileName });
      } catch (error) {
        fileBrowserDebug.error("创建files失败", { error });
        setError("Failed to create file");
        throw error;
      }
    },
    [currentBrowsePath, refreshAfterOperation, setError]
  );

  /**
   * 执行files
   */
  const executeFile = useCallback(
    async (path: string, onOutput?: (output: string) => void) => {
      try {
        fileBrowserDebug.info("执行files", { path });
        const output = await fileOperationsApi.executeFileByPath(path, onOutput);
        fileBrowserDebug.info("执行files成功", { path });
        return output;
      } catch (error) {
        fileBrowserDebug.error("执行files失败", { error });
        const errorMessage = error instanceof Error ? error.message : "Failed to execute file";
        setError(errorMessage);
        if (onOutput) {
          onOutput(`Error: ${errorMessage}`);
        }
        throw error;
      }
    },
    [setError]
  );

  return {
    deleteSelected,
    moveSelected,
    createNewFile,
    executeFile,
    refreshAfterOperation,
  };
}
