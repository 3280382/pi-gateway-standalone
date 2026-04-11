/**
 * Formatters - 格式化工具函数库
 * 纯函数，便于测试和复用
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 格式化日期
 */
export function formatDate(dateString?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options || defaultOptions);
  } catch {
    return dateString;
  }
}

/**
 * 格式化时间为相对时间（如：2分钟前）
 */
export function formatTimeAgo(date: Date | string | number): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) {
    return formatDate(typeof date === "string" ? date : date.toISOString());
  }
  if (diffDay > 0) return `${diffDay}天前`;
  if (diffHour > 0) return `${diffHour}小时前`;
  if (diffMin > 0) return `${diffMin}分钟前`;
  return diffSec < 10 ? "刚刚" : `${diffSec}秒前`;
}

/**
 * 格式化路径（显示最后两级）
 */
export function formatPath(path: string, maxLength: number = 30): string {
  if (!path) return "";

  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return path;

  const shortPath = `.../${parts.slice(-2).join("/")}`;
  return shortPath.length > maxLength ? `.../${parts.slice(-1).join("/")}` : shortPath;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, suffix = "..."): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化数字（添加千分位）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Markdown 简单格式化
 */
export function formatMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // 代码块
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // 粗体
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // 斜体
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // 换行
      .replace(/\n/g, "<br />")
  );
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileNameWithoutExt(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

/**
 * 格式化持续时间（毫秒）
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
