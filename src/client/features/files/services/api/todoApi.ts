/**
 * Todo API Service - Todo 功能客户端
 */

import { fetchApi } from "@/services/client";

export interface TodoItem {
  id: number;
  checked: boolean;
  filePath: string;
  text: string;
}

export interface AddTodoParams {
  workingDir: string;
  filePath: string;
  todoText: string;
}

/**
 * 添加 todo 项
 */
export async function add(params: AddTodoParams): Promise<void> {
  await fetchApi("/files/todo/add", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 获取所有 todo
 */
export async function list(workingDir: string): Promise<TodoItem[]> {
  const response = await fetchApi<{ todos: TodoItem[] }>(
    `/files/todo/list?workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.todos;
}

/**
 * 切换 todo 状态
 */
export async function toggle(workingDir: string, todoId: number): Promise<void> {
  await fetchApi("/files/todo/toggle", {
    method: "POST",
    body: JSON.stringify({ workingDir, todoId }),
  });
}
