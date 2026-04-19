/**
 * Todo Controller - Todo 功能 API
 * 对应 /api/files/todo/* 路由
 *
 * 支持新的todo.md格式：
 * - 人类可读的Markdown格式
 * - AI友好的结构
 * - 机器可解析
 */

import { appendFile, readFile, writeFile } from "node:fs/promises";
import type { Request, Response } from "express";

const TODO_FILE = "todo.md";

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

/**
 * 解析单行todo
 */
function parseTodoLine(line: string, filePath: string, id: number): TodoItem | null {
  const match = line.match(/^- \[([ x])\] (.+)$/);
  if (!match) return null;

  const [, checked, content] = match;

  // 解析标签、指派人、截止日期
  const tags: string[] = [];
  let assignee: string | undefined;
  let dueDate: string | undefined;
  let text = content;

  // 提取截止日期 | YYYY-MM-DD
  const dateMatch = text.match(/\|\s*(\d{4}-\d{2}-\d{2})\s*$/);
  if (dateMatch) {
    dueDate = dateMatch[1];
    text = text.replace(dateMatch[0], "").trim();
  }

  // 提取指派人 @username
  const assigneeMatch = text.match(/@(\w+)/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1];
    text = text.replace(assigneeMatch[0], "").trim();
  }

  // 提取标签 #tag
  const tagMatches = text.matchAll(/#(\w+)/g);
  for (const match of tagMatches) {
    tags.push(match[1]);
  }
  text = text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim();

  // 移除分隔符 |
  text = text.replace(/\|/g, "").trim();

  return {
    id,
    checked: checked === "x",
    filePath,
    text,
    tags,
    assignee,
    dueDate,
    raw: line,
  };
}

/**
 * 解析todofiles内容
 */
function parseTodoContent(content: string): TodoItem[] {
  const lines = content.split("\n");
  const todos: TodoItem[] = [];
  let currentFilePath = "";
  let todoId = 0;

  for (const line of lines) {
    // 检测files路径标题 ### [/path/to/file]
    const pathMatch = line.match(/^### \[(.+)\]$/);
    if (pathMatch) {
      currentFilePath = pathMatch[1];
      continue;
    }

    // 解析todo行
    const todoMatch = line.match(/^- \[([ x])\] /);
    if (todoMatch) {
      const todo = parseTodoLine(line, currentFilePath, todoId);
      if (todo) {
        todos.push(todo);
        todoId++;
      }
    }
  }

  return todos;
}

/**
 * 生成新的todo行
 */
function generateTodoLine(todo: TodoItem): string {
  let line = `- [${todo.checked ? "x" : " "}] ${todo.text}`;

  // 添加标签
  if (todo.tags && todo.tags.length > 0) {
    line += " " + todo.tags.map((t) => `#${t}`).join(" ");
  }

  // 添加指派人
  if (todo.assignee) {
    line += ` @${todo.assignee}`;
  }

  // 添加截止日期
  if (todo.dueDate) {
    line += ` | ${todo.dueDate}`;
  }

  return line;
}

/**
 * 初始化todo.mdfiles
 */
async function initTodoFile(todoFilePath: string): Promise<void> {
  const header = `# Todo List

## Project: Current Directory
Generated: ${new Date().toISOString()}

---

## TODO

---

## Completed

---

## Metadata

### Statistics
- Total: 0
- Pending: 0
- Completed: 0
`;
  await writeFile(todoFilePath, header, "utf-8");
}

/**
 * 检查并修复todo.md格式（如果缺少必要的section）
 */
async function ensureValidTodoFormat(todoFilePath: string, content: string): Promise<string> {
  // 检查是否有必要的section
  if (!content.includes("## TODO")) {
    // 旧格式或损坏的files，重新初始化并保留旧的todos
    const oldLines = content.split("\n").filter((line) => line.trim().startsWith("- ["));

    await initTodoFile(todoFilePath);
    let newContent = await readFile(todoFilePath, "utf-8");

    // 将旧的todos添加到TODO section
    if (oldLines.length > 0) {
      const todoSectionEnd = newContent.indexOf("## Completed");
      const oldTodosFormatted = oldLines
        .map((line) => {
          // 转换旧格式到新格式
          const match = line.match(/^- \[([ x])\] (.+)$/);
          if (match) {
            const [, checked, text] = match;
            return `- [${checked}] ${text}`;
          }
          return line;
        })
        .join("\n");

      newContent =
        newContent.slice(0, todoSectionEnd) +
        oldTodosFormatted +
        "\n" +
        newContent.slice(todoSectionEnd);
      await writeFile(todoFilePath, newContent, "utf-8");
    }

    return newContent;
  }
  return content;
}

/**
 * 添加 todo 项 - 对应 /api/files/todo/add
 */
export async function add(req: Request, res: Response): Promise<void> {
  const {
    workingDir,
    filePath,
    todoText,
    tags = [],
    assignee,
    dueDate,
  } = req.body as {
    workingDir: string;
    filePath: string;
    todoText: string;
    tags?: string[];
    assignee?: string;
    dueDate?: string;
  };

  if (!workingDir || !filePath || !todoText) {
    res.status(400).json({
      error: "Missing required parameters",
      details: {
        workingDir: !!workingDir,
        filePath: !!filePath,
        todoText: !!todoText,
      },
    });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;

    // 检查files是否存在，不存在则初始化
    let content = "";
    try {
      content = await readFile(todoFilePath, "utf-8");
      // 确保格式正确（处理旧格式files）
      content = await ensureValidTodoFormat(todoFilePath, content);
    } catch {
      await initTodoFile(todoFilePath);
      content = await readFile(todoFilePath, "utf-8");
    }

    // 查找TODO部分
    const todoSectionMatch = content.match(/## TODO\n/);
    if (!todoSectionMatch) {
      res.status(500).json({ error: "Invalid todo.md format" });
      return;
    }

    // 构建新的todo项
    const newTodo: TodoItem = {
      id: 0,
      checked: false,
      filePath,
      text: todoText,
      tags,
      assignee,
      dueDate,
      raw: "",
    };
    const todoLine = generateTodoLine(newTodo);

    // 检查是否已存在该files的分Group
    const fileHeaderPattern = new RegExp(
      `^### \\[${filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]$`,
      "m"
    );

    if (fileHeaderPattern.test(content)) {
      // 在现有分Group下添加
      const lines = content.split("\n");
      const newLines: string[] = [];
      let inTargetSection = false;
      let sectionEnded = false;

      for (const line of lines) {
        newLines.push(line);

        if (line.match(fileHeaderPattern)) {
          inTargetSection = true;
        } else if (inTargetSection && line.startsWith("### ") && !line.match(fileHeaderPattern)) {
          // 新的分Group开始，在当前位置插入
          newLines.splice(newLines.length - 1, 0, todoLine);
          inTargetSection = false;
          sectionEnded = true;
        } else if (inTargetSection && line.startsWith("---")) {
          // 节结束，在当前位置插入
          newLines.splice(newLines.length - 1, 0, todoLine);
          inTargetSection = false;
          sectionEnded = true;
        }
      }

      if (!sectionEnded) {
        newLines.push(todoLine);
      }

      content = newLines.join("\n");
    } else {
      // 创建新分Group
      const insertPosition = content.indexOf("## TODO\n") + "## TODO\n".length;
      const newSection = `### [${filePath}]\n${todoLine}\n`;
      content = content.slice(0, insertPosition) + newSection + content.slice(insertPosition);
    }

    await writeFile(todoFilePath, content, "utf-8");

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
 * 获取所有 todo - 对应 /api/files/todo/list
 */
export async function list(req: Request, res: Response): Promise<void> {
  const { workingDir } = req.query as { workingDir: string };

  if (!workingDir) {
    res.status(400).json({ error: "Missing workingDir parameter" });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const content = await readFile(todoFilePath, "utf-8").catch(() => "");

    if (!content) {
      res.json({ todos: [] });
      return;
    }

    const todos = parseTodoContent(content);

    res.json({ todos });
  } catch (error: any) {
    console.error(`[TodoController] Error getting todos: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get todos",
    });
  }
}

/**
 * 切换 todo 状态 - 对应 /api/files/todo/toggle
 */
export async function toggle(req: Request, res: Response): Promise<void> {
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
    const match = line.match(/^- \[([ x])\] /);
    if (!match) {
      res.status(400).json({ error: "Invalid todo line" });
      return;
    }

    if (match[1] === " ") {
      lines[todoId] = line.replace("- [ ]", "- [x]");
    } else {
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

/**
 * 根据files路径获取todos - 对应 /api/files/todo/file
 */
export async function getByFile(req: Request, res: Response): Promise<void> {
  const { workingDir, filePath } = req.query as { workingDir: string; filePath: string };

  if (!workingDir || !filePath) {
    res.status(400).json({ error: "Missing required parameters" });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const content = await readFile(todoFilePath, "utf-8").catch(() => "");

    if (!content) {
      res.json({ todos: [] });
      return;
    }

    const allTodos = parseTodoContent(content);
    const fileTodos = allTodos.filter((t) => t.filePath === filePath);

    res.json({ todos: fileTodos });
  } catch (error: any) {
    console.error(`[TodoController] Error getting file todos: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get file todos",
    });
  }
}

/**
 * 更新 todo 项 - 对应 /api/files/todo/update
 */
export async function update(req: Request, res: Response): Promise<void> {
  const { workingDir, todoId, todoText, tags, assignee, dueDate } = req.body as {
    workingDir: string;
    todoId: number;
    todoText: string;
    tags?: string[];
    assignee?: string;
    dueDate?: string;
  };

  if (!workingDir || todoId === undefined || !todoText) {
    res.status(400).json({
      error: "Missing required parameters",
      details: {
        workingDir: !!workingDir,
        todoId: todoId !== undefined,
        todoText: !!todoText,
      },
    });
    return;
  }

  try {
    const todoFilePath = `${workingDir}/${TODO_FILE}`;
    const content = await readFile(todoFilePath, "utf-8").catch(() => "");

    if (!content) {
      res.status(404).json({ error: "Todo file not found" });
      return;
    }

    // 解析所有 todos 找到要更新的行
    const lines = content.split("\n");
    let currentId = 0;
    let targetLineIndex = -1;
    let currentFilePath = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测files路径标题
      const pathMatch = line.match(/^### \[(.+)\]$/);
      if (pathMatch) {
        currentFilePath = pathMatch[1];
        continue;
      }

      // 解析todo行
      const todoMatch = line.match(/^- \[([ x])\] (.+)$/);
      if (todoMatch) {
        if (currentId === todoId) {
          targetLineIndex = i;
          break;
        }
        currentId++;
      }
    }

    if (targetLineIndex === -1) {
      res.status(404).json({ error: "Todo not found" });
      return;
    }

    // 保留原来的 checked 状态
    const originalMatch = lines[targetLineIndex].match(/^- \[([ x])\] /);
    const checked = originalMatch ? originalMatch[1] === "x" : false;

    // 构建更新后的 todo
    const updatedTodo: TodoItem = {
      id: todoId,
      checked,
      filePath: currentFilePath,
      text: todoText,
      tags: tags || [],
      assignee,
      dueDate,
      raw: "",
    };

    lines[targetLineIndex] = generateTodoLine(updatedTodo);

    await writeFile(todoFilePath, lines.join("\n"), "utf-8");

    console.log(`[TodoController] Updated todo ${todoId}: ${todoText}`);
    res.json({ success: true, message: "Todo updated" });
  } catch (error: any) {
    console.error(`[TodoController] Error updating todo: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update todo",
    });
  }
}
