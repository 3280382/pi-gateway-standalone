/**
 * GitHistoryModal - Git 历史版本浏览弹窗（美化版）
 *
 * Content 使用 FileViewer（带代码高亮）
 * Diff 使用内置窗口（彩色 diff 显示）
 */

import { useEffect, useState } from "react";
import {
  check,
  type GitCommit,
  content as gitContent,
  diff,
  history,
} from "@/features/files/services/api/gitApi";
import { useViewerStore } from "@/features/files/stores/viewerStore";
import styles from "./Modals.module.css";

// 固定的 Git 仓库根目录
const GIT_ROOT = "/root/pi-gateway-standalone";

interface GitHistoryModalProps {
  isOpen: boolean;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function GitHistoryModal({ isOpen, filePath, fileName, onClose }: GitHistoryModalProps) {
  const [history, setHistory] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diff 子窗口状态
  const [diffModal, setDiffModal] = useState<{
    isOpen: boolean;
    commit: GitCommit | null;
    diff: string;
    loading: boolean;
  }>({
    isOpen: false,
    commit: null,
    diff: "",
    loading: false,
  });

  // 使用 FileViewer 显示 Content
  const openViewerWithContent = useViewerStore((state) => state.openViewerWithContent);

  useEffect(() => {
    if (!isOpen || !filePath) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const isGit = await check(GIT_ROOT);
        if (!isGit) {
          setError("Not a git repository");
          setLoading(false);
          return;
        }

        const historyData = await history(filePath, GIT_ROOT);
        setHistory(historyData);

        if (historyData.length === 0) {
          setError("No Git history found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isOpen, filePath]);

  // Content 使用 FileViewer
  const handleViewContent = async (commit: GitCommit) => {
    try {
      const content = await gitContent(filePath, commit.hash, GIT_ROOT);
      // fileName 保持纯净（带扩展名），FileViewer 用它来判断语言
      openViewerWithContent(
        fileName,
        `// ${fileName} @ ${commit.shortHash}\n// ${commit.message}\n\n${content}`,
        "view"
      );
    } catch (err: any) {
      console.error("[GitHistory] Content error:", err);
      openViewerWithContent(
        fileName,
        `Error loading ${fileName} @ ${commit.shortHash}:\n${err?.message || "Failed to load content"}`,
        "view"
      );
    }
  };

  // Diff 使用内置窗口
  const handleViewDiff = async (commit: GitCommit) => {
    setDiffModal({ isOpen: true, commit, diff: "", loading: true });
    try {
      const diff = await diff(filePath, commit.hash, GIT_ROOT);
      setDiffModal({ isOpen: true, commit, diff, loading: false });
    } catch (err: any) {
      console.error("[GitHistory] Diff error:", err);
      setDiffModal({
        isOpen: true,
        commit,
        diff: `Error: ${err?.message || "Failed to load diff"}`,
        loading: false,
      });
    }
  };

  const closeDiffModal = () => {
    setDiffModal({ isOpen: false, commit: null, diff: "", loading: false });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  // 解析 diff 为行
  const parseDiffLines = (diff: string) => {
    return diff.split("\n").map((line, index) => {
      let type = "normal";
      if (line.startsWith("+")) type = "add";
      else if (line.startsWith("-")) type = "remove";
      else if (line.startsWith("@@")) type = "marker";
      else if (
        line.startsWith("diff ") ||
        line.startsWith("index ") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ")
      )
        type = "header";
      return { line, type, index };
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 主窗口 - Git History 列表 */}
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>📜 {fileName}</span>
            <button type="button" className={styles.close} onClick={onClose}>
              ✕
            </button>
          </div>

          <div className={styles.content}>
            {loading && <div className={styles.loading}>Loading...</div>}
            {error && <div className={styles.error}>{error}</div>}

            {!loading && !error && history.length > 0 && (
              <div className={styles.list}>
                {history.map((commit, index) => (
                  <div
                    key={commit.hash}
                    className={`${styles.item} ${index % 2 === 0 ? styles.even : styles.odd}`}
                  >
                    <div className={styles.row1}>
                      <span className={styles.num}>#{history.length - index}</span>
                      <code className={styles.hash}>{commit.shortHash}</code>
                      <span className={styles.author}>{commit.author}</span>
                      <span className={styles.date}>{formatDate(commit.date)}</span>
                      <div className={styles.actions}>
                        <button type="button"
                          className={`${styles.btn} ${styles.cBtn}`}
                          onClick={() => handleViewContent(commit)}
                          title="View content"
                        >
                          📄
                        </button>
                        <button type="button"
                          className={`${styles.btn} ${styles.dBtn}`}
                          onClick={() => handleViewDiff(commit)}
                          title="View diff"
                        >
                          📊
                        </button>
                      </div>
                    </div>
                    <div className={styles.msg}>{commit.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diff 子窗口 */}
      {diffModal.isOpen && (
        <div className={styles.overlay} onClick={closeDiffModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <span className={styles.title}>📊 Diff: {diffModal.commit?.shortHash} → HEAD</span>
              <button type="button" className={styles.close} onClick={closeDiffModal}>
                ✕
              </button>
            </div>
            <div className={styles.content}>
              {diffModal.loading ? (
                <div className={styles.loading}>Loading...</div>
              ) : (
                <div className={styles.diffView}>
                  {parseDiffLines(diffModal.diff).map(({ line, type, index }) => (
                    <div key={index} className={`${styles.diffLine} ${styles[type]}`}>
                      <span className={styles.lineno}>{index + 1}</span>
                      <span className={styles.lineText}>{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
