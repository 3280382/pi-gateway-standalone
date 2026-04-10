/**
 * GitHistoryModal - Git 历史版本浏览弹窗（全屏）
 *
 * 职责：
 * - 全屏显示文件的 Git 历史版本列表
 * - 紧凑布局：第一行（版本号 + Content/Diff 小按钮），第二行（修改摘要）
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

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
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
            <h3>Git History: {fileName}</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className={styles.fullscreenContent}>
            {loading && (
              <div className={styles.centerMessage}>Loading Git history...</div>
            )}

            {error && !loading && (
              <div className={styles.centerMessage} style={{ color: "#f38ba8" }}>
                {error}
              </div>
            )}

            {!loading && !error && history.length > 0 && (
              <div className={styles.compactList}>
                {history.map((commit) => (
                  <div key={commit.hash} className={styles.compactItem}>
                    {/* 第一行：版本号 + 按钮 */}
                    <div className={styles.compactRow1}>
                      <span className={styles.compactHash}>{commit.shortHash}</span>
                      <button
                        className={styles.compactBtn}
                        onClick={() => handleViewContent(commit)}
                        title="View file content at this version"
                      >
                        Content
                      </button>
                      <button
                        className={styles.compactBtn}
                        onClick={() => handleViewDiff(commit)}
                        title="View diff with current version"
                      >
                        Diff
                      </button>
                    </div>
                    {/* 第二行：修改摘要 */}
                    <div className={styles.compactRow2}>
                      <span className={styles.compactMessage}>{commit.message}</span>
                      <span className={styles.compactMeta}>
                        {commit.author} · {formatDate(commit.date)}
                      </span>
                    </div>
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
              <h3>
                {contentModal.type === "content" ? "Content" : "Diff"} at{" "}
                {contentModal.commit?.shortHash}: {contentModal.commit?.message}
              </h3>
              <button className={styles.closeBtn} onClick={closeContentModal}>
                ✕
              </button>
            </div>

            {/* Content */}
            <div className={styles.fullscreenContent}>
              {contentModal.loading ? (
                <div className={styles.centerMessage}>Loading...</div>
              ) : (
                <pre className={styles.codeBlock}>{contentModal.content}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
