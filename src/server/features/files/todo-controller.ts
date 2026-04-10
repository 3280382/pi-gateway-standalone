/**
 * Todo Controller - Todo 功能 API
 */

import { appendFile, readFile, writeFile } from "node:fs/promises";
import type { Request, Response } from "express";

const TODO_FILE = "todo.md";

/**
 * 添加 todo 项
 */
export async function addTodoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { workingDir, filePath, todoText } = req.body as {
    workingDir: string;
    filePath: string;
    todoText: string;
  };

  if (!workingDir || !filePath || !todoText) {
    res.status(400).json({
      error: "Missing required parameters",
      details: { workingDir: !!workingDir, filePath: !!filePath, todoText: !!todoText },
    });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const todoLine = `- [ ] ${filePath} ${todoText}\n`;
    
    await appendFile(todoFilePath, todoLine, "utf-8");
    
    console.log(`[TodoController] Added todo: ${filePath} - ${todoText}`);
    res.json({ success: true, message: "Todo added" });
  } catch (error: any) {
    console.error(`[TodoController] Error adding todo: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to add todo",
    });
  }
}

/**
 * 获取所有 todo
 */
export async function getTodosHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { workingDir } = req.query as { workingDir: string };

  if (!workingDir) {
    res.status(400).json({ error: "Missing workingDir parameter" });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const content = await readFile(todoFilePath, "utf-8").catch(() => "");
    
    // 解析 todo 项
    const lines = content.split("\n").filter(line => line.trim());
    const todos = lines.map((line, index) => {
      const match = line.match(/^- \[([ x])\] (.+)$/);
      if (match) {
        const [, checked, rest] = match;
        const firstSpace = rest.indexOf(" ");
        const filePath = firstSpace > 0 ? rest.slice(0, firstSpace) : rest;
        const text = firstSpace > 0 ? rest.slice(firstSpace + 1) : "";
        return {
          id: index,
          checked: checked === "x",
          filePath,
          text,
          raw: line,
        };
      }
      return null;
    }).filter(Boolean);
    
    res.json({ todos });
  } catch (error: any) {
    console.error(`[TodoController] Error getting todos: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get todos",
    });
  }
}

/**
 * 切换 todo 状态
 */
export async function toggleTodoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { workingDir, todoId } = req.body as {
    workingDir: string;
    todoId: number;
  };

  if (!workingDir || todoId === undefined) {
    res.status(400).json({ error: "Missing required parameters" });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const content = await readFile(todoFilePath, "utf-8");
    const lines = content.split("\n");
    
    if (todoId < 0 || todoId >= lines.length) {
      res.status(404).json({ error: "Todo not found" });
      return;
    }
    
    const line = lines[todoId];
    if (line.startsWith("- [ ]")) {
      lines[todoId] = line.replace("- [ ]", "- [x]");
    } else if (line.startsWith("- [x]")) {
      lines[todoId] = line.replace("- [x]", "- [ ]");
    }
    
    await writeFile(todoFilePath, lines.join("\n"), "utf-8");
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[TodoController] Error toggling todo: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to toggle todo",
    });
  }
}
