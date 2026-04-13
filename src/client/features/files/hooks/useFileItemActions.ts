/**
 * useFileItemActions - 文件项操作逻辑 Hook
 *
 * 职责：管理文件项的交互操作（点击、选择、拖拽、手势等）
 * - 所有交互逻辑封装在此
 * - 组件只负责渲染和绑定事件处理器
 */

import { useCallback, useRef, useState } from "react";
import * as fileOperationsApi from "@/features/files/services/api/fileOperationsApi";
import type { FileItem } from "@/features/files/stores/fileStore";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface PinchState {
  startDistance: number;
  isPinching: boolean;
}

export interface UseFileItemActionsResult {
  // 状态
  isMultiSelectMode: boolean;
  selectedItems: string[];
  draggingItem: string | null;
  dropTarget: string | null;
  showPinchHint: boolean;

  // 文件项事件处理器（直接绑定到 FileItem）
  getItemHandlers: (item: FileItem) => {
    onTap: () => void;
    onDoubleTap: () => void;
    onLongPress: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onToggleSelect: () => void;
  };

  // 容器手势处理器（绑定到 grid/list 容器）
  getContainerHandlers: () => {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };

  // 选择操作
  toggleSelection: (path: string) => void;
  isSelected: (path: string) => boolean;

  // Git 模式
  isGitModeActive: boolean;
}

export function useFileItemActions(): UseFileItemActionsResult {
  const {
    selectedItems,
    isMultiSelectMode,
    isGitModeActive,
    isTodoModeActive,
    setGitHistoryFile,
    setTodoInputFile,
    setCurrentBrowsePath,
    setSelectedActionFile,
    toggleSelection: storeToggleSelection,
    setIsMultiSelectMode,
    setDraggedItem,
    setIsDragging,
    isSelected: storeIsSelected,
  } = useFileStore();

  const { openViewer } = useFileViewerStore();

  // 本地状态
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [showPinchHint, setShowPinchHint] = useState(false);

  // Pinch 手势状态
  const pinchState = useRef<PinchState | null>(null);
  const pinchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ===== 文件项操作 =====

  const handleTap = useCallback(
    (item: FileItem) => {
      console.log("[useFileItemActions] handleTap:", item.name);
      try {
        if (isMultiSelectMode) {
          storeToggleSelection(item.path);
          return;
        }

        // Git 模式下，点击文件触发 Git 历史弹窗
        if (isGitModeActive && !item.isDirectory) {
          console.log("[useFileItemActions] Git mode - selecting file:", item.path);
          setGitHistoryFile({ path: item.path, name: item.name });
          return;
        }

        // 检查是否有待办的 todo，如果有则打开编辑模式
        const todos = useFileStore.getState().todoMap.get(item.path) || [];
        const pendingTodos = todos.filter(t => !t.checked);
        
        if (pendingTodos.length > 0) {
          // 有未完成的 todo，打开编辑模式（编辑第一个未完成的）
          console.log("[useFileItemActions] Editing existing todo:", item.path);
          useFileStore.getState().setEditingTodo(pendingTodos[0]);
          setTodoInputFile({ path: item.path, name: item.name });
          return;
        }
        
        // Todo 模式下，点击文件或目录都弹出 Todo 输入框（新建）
        if (isTodoModeActive) {
          console.log("[useFileItemActions] Todo mode - selecting item:", item.path);
          useFileStore.getState().setEditingTodo(null); // 清空编辑状态
          setTodoInputFile({ path: item.path, name: item.name });
          return;
        }

        if (item.isDirectory) {
          console.log("[useFileItemActions] Navigating to:", item.path);
          // 在文件浏览器中导航只改变 currentBrowsePath，不改变全局 workingDir
          // 同时更新 FileStore 和 WorkspaceStore，保持两者同步
          setCurrentBrowsePath(item.path);
          useWorkspaceStore.getState().setCurrentBrowsePath(item.path);
        } else {
          console.log("[useFileItemActions] Opening viewer:", item.path);
          openViewer(item.path, item.name, "view");
        }
      } catch (err) {
        console.error("[useFileItemActions] handleTap error:", err);
      }
    },
    [
      isMultiSelectMode,
      isGitModeActive,
      isTodoModeActive,
      storeToggleSelection,
      setCurrentBrowsePath,
      openViewer,
      setGitHistoryFile,
      setTodoInputFile,
    ]
  );

  const handleDoubleTap = useCallback(
    (item: FileItem) => {
      if (isMultiSelectMode) return;
      if (item.isDirectory) {
        // 在文件浏览器中导航只改变 currentBrowsePath，不改变全局 workingDir
        setCurrentBrowsePath(item.path);
        useWorkspaceStore.getState().setCurrentBrowsePath(item.path);
      }
    },
    [isMultiSelectMode, setCurrentBrowsePath]
  );

  const handleLongPress = useCallback(
    (item: FileItem) => {
      if (!isMultiSelectMode) {
        setIsMultiSelectMode(true);
      }
      storeToggleSelection(item.path);
    },
    [isMultiSelectMode, setIsMultiSelectMode, storeToggleSelection]
  );

  const _handleSelectForAction = useCallback(
    (item: FileItem) => {
      setSelectedActionFile(item.path, item.name);
    },
    [setSelectedActionFile]
  );

  // ===== 拖拽操作 =====

  const handleDragStart = useCallback(
    (item: FileItem) => (e: React.DragEvent) => {
      setDraggedItem(item);
      setIsDragging(true);
      setDraggingItem(item.path);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.path);
    },
    [setDraggedItem, setIsDragging]
  );

  const handleDragOver = useCallback(
    (item: FileItem) => (e: React.DragEvent) => {
      if (!item.isDirectory) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(item.path);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (targetItem: FileItem) => async (e: React.DragEvent) => {
      e.preventDefault();
      if (!targetItem.isDirectory) return;

      setDropTarget(null);
      setDraggingItem(null);

      try {
        await fileOperationsApi.batchMoveFiles(selectedItems, targetItem.path);
      } catch (error) {
        console.error("Move failed:", error);
      }
    },
    [selectedItems]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setIsDragging(false);
    setDraggingItem(null);
    setDropTarget(null);
  }, [setDraggedItem, setIsDragging]);

  // ===== 手势操作 =====

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const distance = Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);
      pinchState.current = {
        startDistance: distance,
        isPinching: true,
      };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pinchState.current?.isPinching || e.touches.length !== 2) return;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDistance = Math.sqrt(
        (t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2
      );

      const scale = currentDistance / pinchState.current.startDistance;

      // Pinch in (scale < 0.7) triggers multi-select
      if (scale < 0.7 && !isMultiSelectMode) {
        setIsMultiSelectMode(true);
        setShowPinchHint(true);

        if (pinchTimeoutRef.current) {
          clearTimeout(pinchTimeoutRef.current);
        }
        pinchTimeoutRef.current = setTimeout(() => {
          setShowPinchHint(false);
        }, 2000);
      }
    },
    [isMultiSelectMode, setIsMultiSelectMode]
  );

  const handleTouchEnd = useCallback(() => {
    pinchState.current = null;
  }, []);

  // ===== 选择操作 =====

  const toggleSelection = useCallback(
    (path: string) => {
      storeToggleSelection(path);
    },
    [storeToggleSelection]
  );

  const isSelected = useCallback((path: string) => storeIsSelected(path), [storeIsSelected]);

  // ===== 返回绑定的处理器 =====

  const getItemHandlers = useCallback(
    (item: FileItem) => ({
      onTap: () => handleTap(item),
      onDoubleTap: () => handleDoubleTap(item),
      onLongPress: () => handleLongPress(item),
      onDragStart: handleDragStart(item),
      onDragOver: handleDragOver(item),
      onDragLeave: handleDragLeave,
      onDrop: handleDrop(item),
      onDragEnd: handleDragEnd,
      onToggleSelect: () => toggleSelection(item.path),
    }),
    [
      handleTap,
      handleDoubleTap,
      handleLongPress,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleDragEnd,
      toggleSelection,
    ]
  );

  const getContainerHandlers = useCallback(
    () => ({
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    }),
    [handleTouchStart, handleTouchMove, handleTouchEnd]
  );

  return {
    isMultiSelectMode,
    selectedItems,
    draggingItem,
    dropTarget,
    showPinchHint,
    getItemHandlers,
    getContainerHandlers,
    toggleSelection,
    isSelected,
    isGitModeActive,
  };
}
