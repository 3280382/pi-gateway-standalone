/**
 * File API - files操作
 *
 * Responsibilities:
 * - 提供files相关的 API 调用
 * - 不包含业务逻辑，纯数据访问层
 */

import type {
  BrowseResponse,
  FileContentResponse,
  TreeNode,
  TreeResponse,
} from "@/features/files/types";

// 浏览directories
export async function browse(path: string): Promise<BrowseResponse> {
  const response = await fetch("/api/files/file/browse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    throw new Error(`Failed to browse directory: ${response.statusText}`);
  }

  return response.json();
}

// 获取files树
// filter: "all" - 返回所有files, "normal" - 排除隐藏files和默认排除项
export async function tree(path: string, filter: "all" | "normal" = "all"): Promise<TreeResponse> {
  const response = await fetch(
    `/api/files/file/tree?path=${encodeURIComponent(path)}&filter=${filter}`
  );

  if (!response.ok) {
    throw new Error(`Failed to load file tree: ${response.statusText}`);
  }

  const data = await response.json();

  // API returns nested tree structure with children, flatten it for UI
  // 同时计算 level, isLast, parentLastStack 等字段
  const  items: TreeNode[] = [];
  const rootPath = data.path || "";

  function flatten(
    node: TreeNode,
    depth: number = 0,
    parentLastStack: boolean[] = [],
    siblingsCount: number = 0,
    myIndex: number = 0
  ) {
    // Skip the root node itself, only include children
    if (depth > 0) {
      // 保留完整绝对路径，与其他视图（grid/list）保持一致
      const fullPath = node.path;

      // 计算是否是最后一个兄弟节点
      const isLast = myIndex === siblingsCount - 1;

      // 计算相对路径仅用于显示层级关系
      const relativePath = node.path.replace(rootPath, "").replace(/^\//, "");
      const parentPath = relativePath.includes("/")
        ? relativePath.substring(0, relativePath.lastIndexOf("/"))
        : "";

       items.push({
        name: node.name,
        path: fullPath, // 使用完整绝对路径
        isDirectory: node.isDirectory,
        // 新增计算字段
        level: depth - 1, // level 从 0 开始（相对于根的直接子节点）
        isLast: isLast,
        parentLastStack: [...parentLastStack], // 复制数组
        parentPath: parentPath,
      });
    }

    // 递归处理子节点
    if (node.children && !node.truncated) {
      // Sort：先directories后files，然后按名称Sort
      const sortedChildren = [...node.children].sort((a, b) => {
        // 先按类型Sort（directories在前）
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // 再按名称Sort
        return a.name.localeCompare(b.name);
      });

      const childCount = sortedChildren.length;
      const myIsLast = depth === 0 ? false : myIndex === siblingsCount - 1;

      for (let i = 0; i < childCount; i++) {
        flatten(
          sortedChildren[i],
          depth + 1,
          [...parentLastStack, myIsLast], // 将当前节点的 isLast 添加到堆栈
          childCount,
          i
        );
      }
    }
  }

  // data is the root node
  if (data) {
    flatten(data, 0);
  }

  return { path: data.path || path,  items };
}

// 读取files内容
export async function content(path: string): Promise<FileContentResponse> {
  const response = await fetch(`/api/files/file/content?path=${encodeURIComponent(path)}`);

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.statusText}`);
  }

  return response.json();
}

// Write file
export async function write(path: string, content: string): Promise<void> {
  const response = await fetch("/api/files/file/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to write file: ${response.statusText}`);
  }
}

// Get raw file（图片等）
export function raw(path: string): string {
  return `/api/files/file/raw?path=${encodeURIComponent(path)}`;
}

// 执行files
export async function execute(path: string): Promise<ReadableStream<Uint8Array>> {
  // 获取files所在directories作为工作directories
  const dir = path.split("/").slice(0, -1).join("/") || "/";
  const fileName = path.split("/").pop() || "";

  // 构建执行命令
  let command = `./${fileName}`;

  // 根据files类型调整命令
  if (fileName.endsWith(".py")) {
    command = `python3 "${path}"`;
  } else if (fileName.endsWith(".js")) {
    command = `node "${path}"`;
  } else if (fileName.endsWith(".sh") || fileName.endsWith(".bash")) {
    command = `bash "${path}"`;
  }

  const response = await fetch("/api/files/file/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      command: command,
      cwd: dir,
      streaming: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute file: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  return response.body;
}

// 格式化files大小
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

// 获取files图标
export function getFileIcon(extension?: string, isDirectory?: boolean): string {
  if (isDirectory) return "📁";

  const iconMap: Record<string, string> = {
    js: "📜",
    ts: "📘",
    jsx: "⚛️",
    tsx: "⚛️",
    py: "🐍",
    java: "☕",
    go: "🐹",
    rs: "🦀",
    html: "🌐",
    css: "🎨",
    json: "📋",
    md: "📝",
    txt: "📄",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    pdf: "📕",
    zip: "📦",
    tar: "📦",
    gz: "📦",
  };

  return iconMap[extension?.toLowerCase() || ""] || "📄";
}

// Get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length <= 1) return "";
  // Handle hidden files like .gitignore (first part is empty)
  if (parts[0] === "" && parts.length <= 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

// Check if path exists
export async function checkPathExists(path: string): Promise<boolean> {
  try {
    const response = await fetch("/api/files/file/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 获取服务器当前工作directories
export async function getServerWorkingDir(): Promise<string> {
  try {
    const response = await fetch("/api/workspace/working-dir");
    if (response.ok) {
      const data = await response.json();
      if (data.cwd) return data.cwd;
    }
  } catch (error) {
    console.error("[API] Failed to get server working dir:", error);
  }
  return "/root";
}
