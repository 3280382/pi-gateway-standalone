/**
 * SmartContent - 智能内容识别组件
 *
 * Responsibilities:
 * - 自动识别文本中的文件路径和 URL
 * - 文件路径可点击打开 FileViewer
 * - URL 可点击打开 iframe 预览
 * - Markdown 表格渲染为 HTML 表格
 * - 当 smartContentRecognition 关闭时，回退到纯文本渲染
 */

import { useCallback, useMemo } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import styles from "./SmartContent.module.css";

// 常见文件扩展名（用于文件路径识别）
const FILE_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
  "markdown",
  "py",
  "sh",
  "bash",
  "zsh",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "sql",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "rb",
  "php",
  "pl",
  "swift",
  "kt",
  "scala",
  "r",
  "lua",
  "dockerfile",
  "makefile",
  "cmake",
  "txt",
  "csv",
  "log",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];

// 文件路径正则（绝对路径 + 常见扩展名）
const FILE_PATH_RE = new RegExp(
  `(?:^|[\\s(>"'\`])((/[a-zA-Z0-9._\\-]+)+\\.(${FILE_EXTENSIONS.join("|")}))(?=[\\s)<"'\`.,;:]|$)`,
  "gi"
);

// URL 正则
const URL_RE =
  /(?:^|[\s(>])(https?:\/\/[^\s<>"'`)\]}\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+)(?=[\s<)"'`.,;:]|$)/gi;

// Markdown 表格检测正则（至少 2 列）
const TABLE_LINE_RE = /^\|(.+)\|$/;

function isTableLine(line: string): boolean {
  return TABLE_LINE_RE.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line);
}

interface ParsedSegment {
  type: "text" | "file" | "url" | "table";
  value: string;
  path?: string; // for file type
  url?: string; // for url type
  tableRows?: string[][]; // for table type
}

/**
 * Parse text into segments
 */
function parseText(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];

  // Step 1: Split by markdown tables
  // Process line by line to detect table blocks
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a markdown table
    if (isTableLine(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      // Collect table rows
      const tableRows: string[][] = [];

      // Header row
      const headerMatch = line.match(TABLE_LINE_RE);
      if (headerMatch) {
        tableRows.push(headerMatch[1].split("|").map((c) => c.trim()));
      }

      // Skip separator
      i += 2;

      // Data rows
      while (i < lines.length && isTableLine(lines[i])) {
        const rowMatch = lines[i].match(TABLE_LINE_RE);
        if (rowMatch) {
          tableRows.push(rowMatch[1].split("|").map((c) => c.trim()));
        }
        i++;
      }

      segments.push({ type: "table", value: "", tableRows });
      continue;
    }

    // Not a table - process as regular text line
    // Collect consecutive non-table lines
    let textBlock = line;
    i++;
    while (i < lines.length && !isTableLine(lines[i])) {
      textBlock += `\n${lines[i]}`;
      i++;
    }

    // Parse file paths and URLs in this text block
    if (textBlock) {
      const parsedSegments = parseInlineText(textBlock);
      segments.push(...parsedSegments);
    }
  }

  return segments;
}

/**
 * Parse inline text for file paths and URLs
 */
function parseInlineText(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let remaining = text;

  // Combine patterns for ordered scanning
  const patterns: Array<{
    re: RegExp;
    type: "file" | "url";
  }> = [
    { re: FILE_PATH_RE, type: "file" },
    { re: URL_RE, type: "url" },
  ];

  while (remaining.length > 0) {
    let earliestMatch: {
      index: number;
      endIndex: number;
      type: "file" | "url";
      value: string;
    } | null = null;

    for (const { re, type } of patterns) {
      // Create a fresh regex with global flag for each scan
      const scanRe = new RegExp(re.source, re.flags);
      const match = scanRe.exec(remaining);
      if (match) {
        // The captured group (index 1) is the path/url
        const fullMatch = match[0];
        const capturedStart = fullMatch.indexOf(match[1]);
        const matchIndex = match.index + capturedStart;
        const matchEnd = matchIndex + match[1].length;

        if (earliestMatch === null || matchIndex < earliestMatch.index) {
          earliestMatch = {
            index: matchIndex,
            endIndex: matchEnd,
            type,
            value: match[1],
          };
        }
      }
    }

    if (earliestMatch === null) {
      // No more matches
      segments.push({ type: "text", value: remaining });
      break;
    }

    // Text before match
    if (earliestMatch.index > 0) {
      segments.push({
        type: "text",
        value: remaining.substring(0, earliestMatch.index),
      });
    }

    // The match itself
    if (earliestMatch.type === "file") {
      segments.push({
        type: "file",
        value: earliestMatch.value,
        path: earliestMatch.value,
      });
    } else {
      segments.push({
        type: "url",
        value: earliestMatch.value,
        url: earliestMatch.value,
      });
    }

    remaining = remaining.substring(earliestMatch.endIndex);
  }

  return segments;
}

// ============================================================================
// Component
// ============================================================================

interface SmartContentProps {
  text: string;
}

export function SmartContent({ text }: SmartContentProps) {
  const smartContentRecognition = useChatStore((s) => s.smartContentRecognition);

  const segments = useMemo(() => {
    if (!smartContentRecognition || !text) {
      return null;
    }
    return parseText(text);
  }, [text, smartContentRecognition]);

  // If smart recognition is off or no text, render plain
  if (!smartContentRecognition || !segments) {
    return <PlainContent text={text} />;
  }

  return (
    <>
      {segments.map((seg, index) => {
        switch (seg.type) {
          case "text":
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
            return <PlainContent key={index} text={seg.value} />;
          case "file": {
            const path = seg.path ?? "";
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
            return <FileLink key={index} path={path} />;
          }
          case "url": {
            const url = seg.url ?? "";
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
            return <UrlLink key={index} url={url} />;
          }
          case "table": {
            const rows = seg.tableRows ?? [];
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
            return <MarkdownTable key={index} rows={rows} />;
          }
          default:
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
            return <PlainContent key={index} text={seg.value} />;
        }
      })}
    </>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Plain text with markdown-like line formatting
 */
function PlainContent({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, index) => {
        if (line.startsWith("```")) {
          return (
            <div key={`code-${index}-${line.substring(3, 10)}`} className={styles.codeBlockStart}>
              {line.slice(3)}
            </div>
          );
        }

        // Inline code
        if (line.startsWith("`") && line.endsWith("`")) {
          return (
            <code key={`ic-${index}-${line.substring(1, 6)}`} className={styles.inlineCode}>
              {line.slice(1, -1)}
            </code>
          );
        }

        // Bold
        if (line.startsWith("**") && line.endsWith("**")) {
          return <strong key={`b-${index}`}>{line.slice(2, -2)}</strong>;
        }

        // Italic
        if (line.startsWith("*") && line.endsWith("*")) {
          return <em key={`i-${index}`}>{line.slice(1, -1)}</em>;
        }

        return (
          <div key={`ln-${index}`} className={styles.line}>
            {line}
          </div>
        );
      })}
    </>
  );
}

/**
 * Clickable file path that opens FileViewer
 */
function FileLink({ path }: { path: string }) {
  const handleClick = useCallback(() => {
    const name = path.split("/").pop() || path;
    useFileViewerStore.getState().openViewer(path, name, "view");
  }, [path]);

  return (
    <button type="button" className={styles.fileLink} onClick={handleClick} title={`Open ${path}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={styles.fileIcon}
      >
        <title>File</title>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {path}
    </button>
  );
}

/**
 * Clickable URL that opens in iframe preview
 */
function UrlLink({ url }: { url: string }) {
  const openUrl = useCallback(() => {
    useChatStore.getState().setUrlPreview(url);
  }, [url]);

  return (
    <button type="button" className={styles.urlLink} onClick={openUrl} title={`Open ${url}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={styles.urlIcon}
      >
        <title>URL</title>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {url}
    </button>
  );
}

/**
 * Markdown table rendered as HTML table
 */
function MarkdownTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null;

  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headerRow.map((cell, i) => (
              <th key={`h-${i}-${cell.substring(0, 10)}`}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIndex) => (
            <tr key={`r-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`c-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
