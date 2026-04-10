/**
 * GitHistoryModal - Git 历史版本浏览弹窗（美化版）
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

// 固定的 Git 仓库根目录
// 注意：实际应用中应该动态查找 .git 目录
const GIT_ROOT = "/root/pi-gateway-standalone";

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
  // 使用固定的 Git 仓库根目录

  const [history, setHistory] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen || !filePath) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const isGit = await checkGitRepo(GIT_ROOT);
        if (!isGit) {
          setError("Not a git repository");
          setLoading(false);
          return;
        }

        const historyData = await getGitHistory(filePath, GIT_ROOT);
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

  const handleViewContent = async (commit: GitCommit) => {
    setContentModal({ isOpen: true, commit, content: "", type: "content", loading: true });
    try {
      const content = await getGitContent(filePath, commit.hash, GIT_ROOT);
      setContentModal((prev) => ({ ...prev, content, loading: false }));
    } catch (err: any) {
      console.error("[GitHistory] Content error:", err);
      setContentModal((prev) => ({ 
        ...prev, 
        content: `Error: ${err?.message || "Failed to load content"}`, 
        loading: false 
      }));
    }
  };

  const handleViewDiff = async (commit: GitCommit) => {
    setContentModal({ isOpen: true, commit, content: "", type: "diff", loading: true });
    try {
      const diff = await getGitDiff(filePath, commit.hash, GIT_ROOT);
      setContentModal((prev) => ({ ...prev, content: diff, loading: false }));
    } catch (err: any) {
      console.error("[GitHistory] Diff error:", err);
      setContentModal((prev) => ({ 
        ...prev, 
        content: `Error: ${err?.message || "Failed to load diff"}`, 
        loading: false 
      }));
    }
  };

  const closeContentModal = () => {
    setContentModal({ isOpen: false, commit: null, content: "", type: "content", loading: false });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

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
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>📜 {fileName}</span>
            <button className={styles.close} onClick={onClose}>✕</button>
          </div>

          <div className={styles.content}>
            {loading && <div className={styles.loading}>Loading...</div>}
            {error && <div className={styles.error}>{error}</div>}
            
            {!loading && !error && history.length > 0 && (
              <div className={styles.list}>
                {history.map((commit, index) => (
                  <div key={commit.hash} className={`${styles.item} ${index % 2 === 0 ? styles.even : styles.odd}`}>
                    <div className={styles.row1}>
                      <span className={styles.num}>#{history.length - index}</span>
                      <code className={styles.hash}>{commit.shortHash}</code>
                      <span className={styles.author}>{commit.author}</span>
                      <span className={styles.date}>{formatDate(commit.date)}</span>
                      <div className={styles.actions}>
                        <button className={`${styles.btn} ${styles.cBtn}`} onClick={() => handleViewContent(commit)}>📄</button>
                        <button className={`${styles.btn} ${styles.dBtn}`} onClick={() => handleViewDiff(commit)}>📊</button>
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

      {contentModal.isOpen && (
        <div className={styles.overlay} onClick={closeContentModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <span className={styles.title}>
                {contentModal.type === "content" ? "📄" : "📊"} {contentModal.commit?.shortHash}
              </span>
              <button className={styles.close} onClick={closeContentModal}>✕</button>
            </div>
            <div className={styles.content}>
              {contentModal.loading ? (
                <div className={styles.loading}>Loading...</div>
              ) : contentModal.type === "content" ? (
                <pre className={styles.code}>{contentModal.content}</pre>
              ) : (
                <div className={styles.diff}>
                  {parseDiffLines(contentModal.content).map(({ line, type, index }) => (
                    <div key={index} className={`${styles.line} ${styles[type]}`}>
                      <span className={styles.lineno}>{index + 1}</span>
                      <span className={styles.text}>{line}</span>
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
