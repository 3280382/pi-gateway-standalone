/**
 * GitHistoryModal - Git 历史版本浏览弹窗
 *
 * 职责：
 * - 显示文件的 Git 历史版本列表
 * - 每个版本显示版本号、修改说明、作者、日期
 * - 每个版本提供"内容"和"diff"按钮
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
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);

  // 内容/Diff 查看状态
  const [viewMode, setViewMode] = useState<"none" | "content" | "diff">("none");
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [content, setContent] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  // 加载 Git 历史
  useEffect(() => {
    if (!isOpen || !filePath || !workingDir) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      setViewMode("none");
      setSelectedCommit(null);

      try {
        // 先检查是否是 Git 仓库
        const isGit = await checkGitRepo(workingDir);
        setIsGitRepo(isGit);

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

  // 查看指定版本的内容
  const handleViewContent = async (commit: GitCommit) => {
    if (!workingDir) return;

    setContentLoading(true);
    setViewMode("content");
    setSelectedCommit(commit);
    setDiff("");

    try {
      const contentData = await getGitContent(filePath, commit.hash, workingDir);
      setContent(contentData);
    } catch (err) {
      setContent(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setContentLoading(false);
    }
  };

  // 查看指定版本与当前的 diff
  const handleViewDiff = async (commit: GitCommit) => {
    if (!workingDir) return;

    setContentLoading(true);
    setViewMode("diff");
    setSelectedCommit(commit);
    setContent("");

    try {
      const diffData = await getGitDiff(filePath, commit.hash, workingDir);
      setDiff(diffData);
    } catch (err) {
      setDiff(err instanceof Error ? err.message : "Failed to load diff");
    } finally {
      setContentLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.gitHistoryModal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.gitHistoryHeader}>
          <h3>Git History: {fileName}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.gitHistoryContent}>
          {loading && (
            <div className={styles.loadingState}>Loading Git history...</div>
          )}

          {error && !loading && (
            <div className={styles.errorState}>{error}</div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className={styles.gitHistoryLayout}>
              {/* 左侧：历史列表 */}
              <div className={styles.historyList}>
                {history.map((commit) => (
                  <div
                    key={commit.hash}
                    className={`${styles.historyItem} ${
                      selectedCommit?.hash === commit.hash ? styles.active : ""
                    }`}
                  >
                    <div className={styles.commitInfo}>
                      <div className={styles.commitHash}>{commit.shortHash}</div>
                      <div className={styles.commitMessage}>{commit.message}</div>
                      <div className={styles.commitMeta}>
                        <span>{commit.author}</span>
                        <span>{formatDate(commit.date)}</span>
                      </div>
                    </div>
                    <div className={styles.commitActions}>
                      <button
                        className={styles.commitBtn}
                        onClick={() => handleViewContent(commit)}
                        title="View file content at this version"
                      >
                        Content
                      </button>
                      <button
                        className={styles.commitBtn}
                        onClick={() => handleViewDiff(commit)}
                        title="View diff with current version"
                      >
                        Diff
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 右侧：内容/Diff 显示 */}
              <div className={styles.historyDetail}>
                {viewMode === "none" && (
                  <div className={styles.emptyState}>
                    Select a version and click &quot;Content&quot; or &quot;Diff&quot; to view
                  </div>
                )}

                {contentLoading && (
                  <div className={styles.loadingState}>Loading...</div>
                )}

                {viewMode === "content" && !contentLoading && (
                  <div className={styles.contentView}>
                    <div className={styles.contentHeader}>
                      Content at {selectedCommit?.shortHash}: {selectedCommit?.message}
                    </div>
                    <pre className={styles.contentCode}>{content}</pre>
                  </div>
                )}

                {viewMode === "diff" && !contentLoading && (
                  <div className={styles.diffView}>
                    <div className={styles.contentHeader}>
                      Diff: {selectedCommit?.shortHash} → HEAD
                    </div>
                    <pre className={styles.diffCode}>{diff}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
