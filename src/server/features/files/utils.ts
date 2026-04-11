/**
 * 文件系统工具函数
 */

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";

/**
 * 扩展路径（处理~和相对路径）
 */
export function expandPath(targetPath: string): string {
  if (targetPath === "~" || targetPath.startsWith("~/")) {
    return targetPath.replace("~", homedir());
  }
  return targetPath;
}

/**
 * 安全检查防止目录遍历攻击。
 * 确保解析的路径在允许的目录内。
 */
export function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(expandPath(targetPath));
  const home = homedir();
  const cwd = process.cwd();

  // 允许主目录、当前工作目录或/tmp内的路径
  const allowedPrefixes = [home, cwd, "/tmp"];
  return allowedPrefixes.some((prefix) => resolved.startsWith(path.resolve(prefix)));
}

/**
 * 获取文件扩展名
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * 从文件扩展名确定MIME类型
 */
export function getMimeType(filePath: string): string {
  const ext = getExtension(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".yml": "text/yaml",
    ".yaml": "text/yaml",
    ".xml": "text/xml",
    ".csv": "text/csv",
    ".ts": "application/typescript",
    ".tsx": "application/typescript",
    ".jsx": "application/javascript",
    ".py": "text/x-python",
    ".sh": "text/x-shellscript",
    ".go": "text/x-go",
    ".rs": "text/x-rust",
    ".java": "text/x-java",
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".h": "text/x-c",
    ".hpp": "text/x-c++",
    ".php": "text/x-php",
    ".rb": "text/x-ruby",
    ".pl": "text/x-perl",
    ".sql": "text/x-sql",
    ".log": "text/plain",
    ".conf": "text/plain",
    ".ini": "text/plain",
    ".toml": "text/toml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".mkv": "video/x-matroska",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * 检查文件扩展名是否支持语法高亮
 */
export function isHighlightable(filePath: string): boolean {
  const ext = getExtension(filePath);
  const highlightableExtensions = [
    ".js",
    ".mjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".sh",
    ".bash",
    ".zsh",
    ".fish",
    ".ps1",
    ".sql",
    ".pl",
    ".lua",
    ".r",
    ".swift",
    ".kt",
    ".scala",
    ".groovy",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".styl",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".md",
    ".markdown",
    ".rst",
    ".tex",
    ".latex",
    ".dockerfile",
    ".dockerignore",
    ".gitignore",
    ".gitattributes",
    ".txt",
    ".log",
    ".diff",
    ".patch",
    ".vue",
    ".svelte",
    ".astro",
    ".graphql",
    ".gql",
    ".cs",
    ".fs",
    ".vb",
  ];
  return highlightableExtensions.includes(ext);
}

/**
 * 检查文件是否是二进制文件
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = getExtension(filePath);
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".bmp",
    ".tiff",
    ".mp3",
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    ".wav",
    ".ogg",
    ".flac",
    ".mkv",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".rar",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".jar",
    ".war",
    ".ear",
    ".apk",
    ".ipa",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
  ];
  return binaryExtensions.includes(ext);
}

/**
 * 快速检查目录是否存在并可访问
 */
export function isDirectoryAccessible(dirPath: string): boolean {
  try {
    const stats = statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 快速检查文件是否存在并可访问
 */
export function isFileAccessible(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * 递归获取目录树
 */
export interface DirectoryTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
  children?: DirectoryTreeNode[];
}

/**
 * 获取目录树（限制深度）
 */
export function getDirectoryTree(rootPath: string, maxDepth: number = 3): DirectoryTreeNode | null {
  try {
    const stats = statSync(rootPath);
    if (!stats.isDirectory()) {
      return {
        name: path.basename(rootPath),
        path: rootPath,
        isDirectory: false,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    }

    const readDirectory = (currentPath: string, depth: number): DirectoryTreeNode => {
      const name = path.basename(currentPath);
      const stats = statSync(currentPath);

      const node: DirectoryTreeNode = {
        name,
        path: currentPath,
        isDirectory: true,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };

      if (depth < maxDepth) {
        try {
          const entries = readdirSync(currentPath);
          node.children = entries.map((entry) => {
            const fullPath = path.join(currentPath, entry);
            const childStats = statSync(fullPath);

            if (childStats.isDirectory()) {
              return readDirectory(fullPath, depth + 1);
            } else {
              return {
                name: entry,
                path: fullPath,
                isDirectory: false,
                size: childStats.size,
                modified: childStats.mtime.toISOString(),
              };
            }
          });
        } catch {
          // 忽略无法访问的目录
          node.children = [];
        }
      }

      return node;
    };

    return readDirectory(rootPath, 0);
  } catch {
    return null;
  }
}

/**
 * 获取人类可读的文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

/**
 * 获取人类可读的时间间隔
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}天前`;
  if (diffHour > 0) return `${diffHour}小时前`;
  if (diffMin > 0) return `${diffMin}分钟前`;
  return `${diffSec}秒前`;
}
