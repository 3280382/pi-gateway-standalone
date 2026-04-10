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
export async function addTodo(params: AddTodoParams): Promise<void> {
  await fetchApi("/todo/add", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 获取所有 todo
 */
export async function getTodos(workingDir: string): Promise<TodoItem[]> {
  const response = await fetchApi<{ todos: TodoItem[] }>(
    `/todo/list?workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.todos;
}

/**
 * 切换 todo 状态
 */
export async function toggleTodo(workingDir: string, todoId: number): Promise<void> {
  await fetchApi("/todo/toggle", {
    method: "POST",
    body: JSON.stringify({ workingDir, todoId }),
  });
}
