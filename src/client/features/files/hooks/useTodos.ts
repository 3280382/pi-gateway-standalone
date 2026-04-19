/**
 * useTodos - Todo列表管理 Hook
 *
 * Responsibilities:
 * - 加载工作directories的todo列表
 * - 缓存并按files路径分Group
 * - 提供Refresh功能
 */

import { useCallback, useEffect, useRef } from "react";
import * as todoApi from "@/features/files/services/api/todoApi";
import { useFileStore } from "@/features/files/stores/fileStore";

export interface UseTodosOptions {
  /** 是否处于激活状态 */
  isActive?: boolean;
  /** 当前浏览路径 */
  workingDir: string;
}

export interface UseTodosResult {
  refresh: () => Promise<void>;
}

export function useTodos(options: UseTodosOptions): UseTodosResult {
  const { isActive = true, workingDir } = options;
  const { isTodoModeActive, setTodoList, setTodoMap } = useFileStore();
  const lastLoadedDirRef = useRef<string>("");

  const refresh = useCallback(async () => {
    // 防止重复加载同一directories
    if (!workingDir || workingDir === lastLoadedDirRef.current) return;

    try {
      const todos = await todoApi.list(workingDir);
      setTodoList(todos);

      // 按files路径分Group
      const map = new Map<string, typeof todos>();
      for (const todo of todos) {
        const existing = map.get(todo.filePath) || [];
        existing.push(todo);
        map.set(todo.filePath, existing);
      }
      setTodoMap(map);
      lastLoadedDirRef.current = workingDir;
    } catch (err) {
      console.error("[useTodos] Failed to load todos:", err);
    }
  }, [workingDir, setTodoList, setTodoMap]);

  // 初始加载，使用 ref 防止重复
  useEffect(() => {
    // 非激活状态或 Todo 模式Close时不加载
    if (!isActive || !isTodoModeActive) {
      // Clear状态
      if (lastLoadedDirRef.current) {
        setTodoList([]);
        setTodoMap(new Map());
        lastLoadedDirRef.current = "";
      }
      return;
    }

    if (workingDir && workingDir !== lastLoadedDirRef.current) {
      refresh();
    }
  }, [isActive, isTodoModeActive, workingDir, refresh, setTodoList, setTodoMap]);

  return { refresh };
}
