/**
 * useTodos - Todo列表管理 Hook
 *
 * 职责：
 * - 加载工作目录的todo列表
 * - 缓存并按文件路径分组
 * - 提供刷新功能
 */

import { useCallback, useEffect } from "react";
import * as todoApi from "@/features/files/services/api/todoApi";
import { useFileStore } from "@/features/files/stores/fileStore";

export interface UseTodosResult {
  refresh: () => Promise<void>;
}

export function useTodos(workingDir: string): UseTodosResult {
  const { setTodoList, setTodoMap } = useFileStore();

  const refresh = useCallback(async () => {
    if (!workingDir) return;

    try {
      const todos = await todoApi.list(workingDir);
      setTodoList(todos);

      // 按文件路径分组
      const map = new Map<string, typeof todos>();
      for (const todo of todos) {
        const existing = map.get(todo.filePath) || [];
        existing.push(todo);
        map.set(todo.filePath, existing);
      }
      setTodoMap(map);
    } catch (err) {
      console.error("[useTodos] Failed to load todos:", err);
    }
  }, [workingDir, setTodoList, setTodoMap]);

  // 初始加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
}
