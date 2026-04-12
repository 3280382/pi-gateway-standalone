/**
 * useFileOperations - 文件操作逻辑 Hook
 *
 * 职责：封装文件增删改查的业务逻辑
 * - 批量删除
 * - 批量移动
 * - 创建文件
 * - 执行文件
 */

import { useCallback } from "react";
import * as fileOperationsApi from "@/features/files/services/api/fileOperationsApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { fileBrowserDebug } from "@/lib/debug";

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
    workingDir,
    setItems,
    setWorkingDir,
    setParentPath,
    setError,
    setSelectedItems,
    setIsMultiSelectMode,
  } = useFileStore();

  /**
   * 操作后刷新目录
   */
  const refreshAfterOperation = useCallback(async () => {
    try {
      const data = await fileOperationsApi.loadDirectoryContent(workingDir);
      setItems(data.items);
      setWorkingDir(data.workingDir);
      setParentPath(data.parentPath);
    } catch (error) {
      fileBrowserDebug.error("刷新目录失败", { error });
      setError("Failed to refresh directory");
    }
  }, [workingDir, setItems, setWorkingDir, setParentPath, setError]);

  /**
   * 批量删除选中的文件
   */
  const deleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;

    try {
      fileBrowserDebug.info("批量删除文件", { paths: selectedItems });
      await fileOperationsApi.batchDeleteFiles(selectedItems);

      // 刷新目录
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
   * 批量移动选中的文件
   */
  const moveSelected = useCallback(
    async (targetPath: string) => {
      if (selectedItems.length === 0) return;

      try {
        fileBrowserDebug.info("批量移动文件", {
          paths: selectedItems,
          targetPath,
        });
        await fileOperationsApi.batchMoveFiles(selectedItems, targetPath);

        // 刷新目录
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
   * 创建新文件
   */
  const createNewFile = useCallback(
    async (fileName: string) => {
      try {
        fileBrowserDebug.info("创建新文件", { fileName, workingDir });
        await fileOperationsApi.createFile(workingDir, fileName);

        // 刷新目录
        await refreshAfterOperation();

        fileBrowserDebug.info("创建文件成功", { fileName });
      } catch (error) {
        fileBrowserDebug.error("创建文件失败", { error });
        setError("Failed to create file");
        throw error;
      }
    },
    [workingDir, refreshAfterOperation, setError]
  );

  /**
   * 执行文件
   */
  const executeFile = useCallback(
    async (path: string, onOutput?: (output: string) => void) => {
      try {
        fileBrowserDebug.info("执行文件", { path });
        const output = await fileOperationsApi.executeFileByPath(path, onOutput);
        fileBrowserDebug.info("执行文件成功", { path });
        return output;
      } catch (error) {
        fileBrowserDebug.error("执行文件失败", { error });
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
