/**
 * Todo API Service - Todo 功能客户端
 * 
 * 支持新的todo.md格式
 */

import { fetchApi } from "@/services/client";

export interface TodoItem {
  id: number;
  checked: boolean;
  filePath: string;
  text: string;
  tags: string[];
  assignee?: string;
  dueDate?: string;
  raw: string;
}

export interface AddTodoParams {
  workingDir: string;
  filePath: string;
  todoText: string;
  tags?: string[];
  assignee?: string;
  dueDate?: string;
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
 * 获取指定文件的 todos
 */
export async function getByFile(workingDir: string, filePath: string): Promise<TodoItem[]> {
  const response = await fetchApi<{ todos: TodoItem[] }>(
    `/files/todo/file?workingDir=${encodeURIComponent(workingDir)}&filePath=${encodeURIComponent(filePath)}`
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

export interface UpdateTodoParams {
  workingDir: string;
  todoId: number;
  todoText: string;
  tags?: string[];
  assignee?: string;
  dueDate?: string;
}

/**
 * 更新 todo 项
 */
export async function update(params: UpdateTodoParams): Promise<void> {
  await fetchApi("/files/todo/update", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 获取优先级颜色
 */
export function getPriorityColor(tags: string[]): string {
  if (tags.includes("urgent") || tags.includes("high")) return "#f85149"; // 红色
  if (tags.includes("medium")) return "#d29922"; // 黄色
  if (tags.includes("low")) return "#58a6ff"; // 蓝色
  return "#8b949e"; // 灰色默认
}

/**
 * 获取todo状态显示文本
 */
export function getTodoStatus(item: TodoItem): string {
  if (item.checked) return "✓";
  if (item.tags.includes("urgent")) return "⚠";
  if (item.tags.includes("high")) return "‼";
  return "○";
}
