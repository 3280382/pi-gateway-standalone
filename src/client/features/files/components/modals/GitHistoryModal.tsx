/**
 * GitHistoryModal - Git 历史版本浏览弹窗（全屏 + 美化版）
 *
 * 职责：
 * - 全屏显示文件的 Git 历史版本列表
 * - 单行布局：版本号 + 作者 + 日期 + Content/Diff 按钮
 * - 第二行：完整修改摘要（不截断）
 * - 点击 Content/Diff 弹出子窗口显示
 */

import { useEffect, useState } from "react";
import {
  checkGitRepo,
  getGitContent,
  getGitDiff,
  getGitHistory,
  type GitCommit,
} from "@/features/files/services/gitApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import styles from "./Modals.module.css";

interface GitHistoryModalProps {
  isOpen: boolean;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function GitHistoryModal({
  isOpen,
  filePath,
  fileName,
  onClose,
}: GitHistoryModalProps) {
  const workingDir = useFileStore((state) => state.workingDir);

  const [history, setHistory] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 子窗口状态
  const [contentModal, setContentModal] = useState<{
    isOpen: boolean;
    commit: GitCommit | null;
    content: string;
    type: "content" | "diff";
    loading: boolean;
  }>({
    isOpen: false,
    commit: null,
    content: "",
    type: "content",
    loading: false,
  });

  // 加载 Git 历史
  useEffect(() => {
    if (!isOpen || !filePath || !workingDir) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const isGit = await checkGitRepo(workingDir);
        if (!isGit) {
          setError("Current directory is not a Git repository");
          setLoading(false);
          return;
        }

        const historyData = await getGitHistory(filePath, workingDir);
        setHistory(historyData);

        if (historyData.length === 0) {
          setError("No Git history found for this file");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Git history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isOpen, filePath, workingDir]);

  // 查看指定版本的内容（弹出子窗口）
  const handleViewContent = async (commit: GitCommit) => {
    if (!workingDir) return;

    setContentModal({
      isOpen: true,
      commit,
      content: "",
      type: "content",
      loading: true,
    });

    try {
      const contentData = await getGitContent(filePath, commit.hash, workingDir);
      setContentModal((prev) => ({ ...prev, content: contentData, loading: false }));
    } catch (err) {
      setContentModal((prev) => ({
        ...prev,
        content: err instanceof Error ? err.message : "Failed to load content",
        loading: false,
      }));
    }
  };

  // 查看指定版本与当前的 diff（弹出子窗口）
  const handleViewDiff = async (commit: GitCommit) => {
    if (!workingDir) return;

    setContentModal({
      isOpen: true,
      commit,
      content: "",
      type: "diff",
      loading: true,
    });

    try {
      const diffData = await getGitDiff(filePath, commit.hash, workingDir);
      setContentModal((prev) => ({ ...prev, content: diffData, loading: false }));
    } catch (err) {
      setContentModal((prev) => ({
        ...prev,
        content: err instanceof Error ? err.message : "Failed to load diff",
        loading: false,
      }));
    }
  };

  // 关闭子窗口
  const closeContentModal = () => {
    setContentModal({
      isOpen: false,
      commit: null,
      content: "",
      type: "content",
      loading: false,
    });
  };

  // 格式化日期 - 更紧凑的格式
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 解析 diff 为行
  const parseDiffLines = (diff: string) => {
    return diff.split("\n").map((line, index) => {
      let type = "normal";
      if (line.startsWith("+")) type = "add";
      else if (line.startsWith("-")) type = "remove";
      else if (line.startsWith("@@")) type = "marker";
      else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) type = "header";
      return { line, type, index };
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 主窗口 - 全屏 */}
      <div className={styles.fullscreenOverlay} onClick={onClose}>
        <div
          className={styles.fullscreenModal}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.fullscreenHeader}>
            <div className={styles.headerLeft}>
              <GitIcon />
              <span className={styles.headerTitle}>{fileName}</span>
              <span className={styles.headerSubtitle}>{history.length} commits</span>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className={styles.fullscreenContent}>
            {loading && (
              <div className={styles.centerMessage}>
                <div className={styles.spinner} />
                <span>Loading Git history...</span>
              </div>
            )}

            {error && !loading && (
              <div className={styles.centerMessage}>
                <span className={styles.errorIcon}>⚠</span>
                <span style={{ color: "#f38ba8" }}>{error}</span>
              </div>
            )}

            {!loading && !error && history.length > 0 && (
              <div className={styles.commitList}>
                {history.map((commit, index) => (
                  <div key={commit.hash} className={styles.commitCard}>
                    {/* 第一行：版本号 + 作者 + 日期 + 按钮 */}
                    <div className={styles.commitRow1}>
                      <span className={styles.commitIndex}>#{history.length - index}</span>
                      <span className={styles.commitHash}>{commit.shortHash}</span>
                      <span className={styles.commitAuthor}>{commit.author}</span>
                      <span className={styles.commitDate}>{formatDate(commit.date)}</span>
                      <div className={styles.commitActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.contentBtn}`}
                          onClick={() => handleViewContent(commit)}
                          title="View file content at this version"
                        >
                          📄 Content
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.diffBtn}`}
                          onClick={() => handleViewDiff(commit)}
                          title="View diff with current version"
                        >
                          📊 Diff
                        </button>
                      </div>
                    </div>
                    {/* 第二行：完整修改摘要 */}
                    <div className={styles.commitMessage}>{commit.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 子窗口 - 显示 Content 或 Diff */}
      {contentModal.isOpen && (
        <div className={styles.fullscreenOverlay} onClick={closeContentModal}>
          <div
            className={styles.fullscreenModal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.fullscreenHeader}>
              <div className={styles.headerLeft}>
                {contentModal.type === "content" ? <FileIcon /> : <DiffIcon />}
                <span className={styles.headerTitle}>
                  {contentModal.type === "content" ? "Content" : "Diff"} at {contentModal.commit?.shortHash}
                </span>
                <span className={styles.headerSubtitle}>
                  {contentModal.commit?.message}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={closeContentModal}>
                ✕
              </button>
            </div>

            {/* Content */}
            <div className={styles.fullscreenContent}>
              {contentModal.loading ? (
                <div className={styles.centerMessage}>
                  <div className={styles.spinner} />
                  <span>Loading...</span>
                </div>
              ) : contentModal.type === "content" ? (
                <pre className={styles.codeView}>{contentModal.content}</pre>
              ) : (
                <div className={styles.diffView}>
                  {parseDiffLines(contentModal.content).map(({ line, type, index }) => (
                    <div key={index} className={`${styles.diffLine} ${styles[type]}`}>
                      <span className={styles.diffLineNum}>{index + 1}</span>
                      <span className={styles.diffLineContent}>{line}</span>
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

// Icons
function GitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8V4" />
      <path d="M12 20v-4" />
      <path d="M4 12h4" />
      <path d="M16 12h4" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DiffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M7 8l-4 4 4 4" />
      <path d="M17 8l4 4-4 4" />
    </svg>
  );
}
