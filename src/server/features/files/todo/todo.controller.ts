/**
 * Todo Controller - Todo feature API
 * Corresponds to /api/files/todo/* routes
 *
 * Supports new todo.md format:
 * - Human-readable Markdown format
 * - AI-friendly structure
 * - Machine-parseable
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
 * Parse single todo line
 */
function parseTodoLine(line: string, filePath: string, id: number): TodoItem | null {
  const match = line.match(/^- \[([ x])\] (.+)$/);
  if (!match) return null;

  const [, checked, content] = match;

  // Parse tags, assignee, due date
  const tags: string[] = [];
  let assignee: string | undefined;
  let dueDate: string | undefined;
  let text = content;

  // Extract due date | YYYY-MM-DD
  const dateMatch = text.match(/\|\s*(\d{4}-\d{2}-\d{2})\s*$/);
  if (dateMatch) {
    dueDate = dateMatch[1];
    text = text.replace(dateMatch[0], "").trim();
  }

  // Extract assignee @username
  const assigneeMatch = text.match(/@(\w+)/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1];
    text = text.replace(assigneeMatch[0], "").trim();
  }

  // Extract tag #tag
  const tagMatches = text.matchAll(/#(\w+)/g);
  for (const match of tagMatches) {
    tags.push(match[1]);
  }
  text = text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim();

  // Remove delimiter |
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
 * Parse todo file content
 */
function parseTodoContent(content: string): TodoItem[] {
  const lines = content.split("\n");
  const todos: TodoItem[] = [];
  let currentFilePath = "";
  let todoId = 0;

  for (const line of lines) {
    // Detect file path header ### [/path/to/file]
    const pathMatch = line.match(/^### \[(.+)\]$/);
    if (pathMatch) {
      currentFilePath = pathMatch[1];
      continue;
    }

    // Parse todo line
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
 * Generate new todo line
 */
function generateTodoLine(todo: TodoItem): string {
  let line = `- [${todo.checked ? "x" : " "}] ${todo.text}`;

  // Add tags
  if (todo.tags && todo.tags.length > 0) {
    line += " " + todo.tags.map((t) => `#${t}`).join(" ");
  }

  // Add assignee
  if (todo.assignee) {
    line += ` @${todo.assignee}`;
  }

  // Add due date
  if (todo.dueDate) {
    line += ` | ${todo.dueDate}`;
  }

  return line;
}

/**
 * Initialize todo.md file
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
 * Check and fix todo.md format (if missing necessary sections)
 */
async function ensureValidTodoFormat(todoFilePath: string, content: string): Promise<string> {
  // Check if necessary sections exist
  if (!content.includes("## TODO")) {
    // Old format or corrupted file, reinitialize and keep old todos
    const oldLines = content.split("\n").filter((line) => line.trim().startsWith("- ["));

    await initTodoFile(todoFilePath);
    let newContent = await readFile(todoFilePath, "utf-8");

    // Add old todos to TODO section
    if (oldLines.length > 0) {
      const todoSectionEnd = newContent.indexOf("## Completed");
      const oldTodosFormatted = oldLines
        .map((line) => {
          // Convert old format to new format
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
 * Add todo item - corresponds to /api/files/todo/add
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

    // Check if file exists, initialize if not
    let content = "";
    try {
      content = await readFile(todoFilePath, "utf-8");
      // Ensure format correct (handle old format files)
      content = await ensureValidTodoFormat(todoFilePath, content);
    } catch {
      await initTodoFile(todoFilePath);
      content = await readFile(todoFilePath, "utf-8");
    }

    // Find TODO section
    const todoSectionMatch = content.match(/## TODO\n/);
    if (!todoSectionMatch) {
      res.status(500).json({ error: "Invalid todo.md format" });
      return;
    }

    // Build new todo item
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

    // Check if file group already exists
    const fileHeaderPattern = new RegExp(
      `^### \\[${filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]$`,
      "m"
    );

    if (fileHeaderPattern.test(content)) {
      // Add under existing group
      const lines = content.split("\n");
      const newLines: string[] = [];
      let inTargetSection = false;
      let sectionEnded = false;

      for (const line of lines) {
        newLines.push(line);

        if (line.match(fileHeaderPattern)) {
          inTargetSection = true;
        } else if (inTargetSection && line.startsWith("### ") && !line.match(fileHeaderPattern)) {
          // New group starts, insert at current position
          newLines.splice(newLines.length - 1, 0, todoLine);
          inTargetSection = false;
          sectionEnded = true;
        } else if (inTargetSection && line.startsWith("---")) {
          // Section ends, insert at current position
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
      // Create new group
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
 * Toggle todo status - corresponds to /api/files/todo/toggle
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

    // 解析所有 todos 找到要更新的Rows
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

      // Parse todo line
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
