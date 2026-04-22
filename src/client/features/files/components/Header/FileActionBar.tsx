/**
 * FileActionBar - 选中files操作栏
 */

import { useFileViewer } from "@/features/files/hooks";
import { useFileStore } from "@/features/files/stores/fileStore";
import styles from "../FileBrowser/FileBrowser.module.css";

// Executablefiles扩展名Cols表
const EXECUTABLE_EXTENSIONS = [
  "sh",
  "bash",
  "zsh",
  "py",
  "js",
  "ts",
  "pl",
  "rb",
  "php",
  "go",
  "java",
  "c",
  "cpp",
  "rs",
];

// 不可编辑的files扩展名Cols表
const NON_EDITABLE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "ico", "pdf"];

interface FileActionBarProps {
  onExecute?: (output: string) => void;
  onOpenBottomPanel?: (output: string) => void;
}

export function FileActionBar({ onExecute, onOpenBottomPanel }: FileActionBarProps) {
  // ========== 1. State ==========
  const { selectedActionFile, selectedActionFileName } = useFileStore();
  const {
    loadFile: viewFile,
    saveFile: editFile,
    execute: executeFileStream,
  } = useFileViewer() as any;

  // ========== 2. Ref ==========
  // 暂无直接DOM引用

  // ========== 3. Effects ==========
  // 暂无外部副作用

  // ========== 4. Computed ==========
  // 无选中files时不渲染
  if (!selectedActionFile) {
    return null;
  }

  const ext = selectedActionFile.split(".").pop()?.toLowerCase() || "";

  // 判断files是否Executable
  const isExecutable =
    EXECUTABLE_EXTENSIONS.some((ext) =>
      selectedActionFileName?.toLowerCase().endsWith(`.${ext}`)
    ) || !selectedActionFileName?.includes(".");

  // 判断files是否可编辑
  const isEditable = !NON_EDITABLE_EXTENSIONS.includes(ext);

  // ========== 5. Actions ==========
  // 处理查看
  const handleView = () => {
    viewFile(selectedActionFile, selectedActionFileName || "");
  };

  // 处理编辑
  const handleEdit = () => {
    editFile(selectedActionFile, selectedActionFileName || "");
  };

  // 处理执Rows
  const handleExecute = async () => {
    await executeFileStream(
      selectedActionFile,
      selectedActionFileName || "",
      onExecute,
      onOpenBottomPanel
    );
  };

  // ========== 6. Render ==========
  return (
    <div className={styles.actionBar}>
      <span className={styles.selectedName}>{selectedActionFileName}</span>
      <button type="button" className={`${styles.actionBtn} ${styles.view}`} onClick={handleView}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        View
      </button>
      {isEditable && (
        <button type="button" className={`${styles.actionBtn} ${styles.edit}`} onClick={handleEdit}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
      )}
      {isExecutable && (
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.execute}`}
          onClick={handleExecute}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Run
        </button>
      )}
    </div>
  );
}
