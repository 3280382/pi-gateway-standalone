/**
 * FileViewer - 文件查看器模态框
 */

import { useEffect, useRef } from 'react';
import { useFileViewerStore } from '../../store/fileViewerStore';
import { readFile, writeFile, executeFile, getRawFileUrl } from '../../api/fileApi';
import Prism from 'prismjs';
import styles from './FileViewer.module.css';

// 加载 Prism 语言组件
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';

export function FileViewer() {
  const {
    isOpen,
    filePath,
    fileName,
    mode,
    content,
    isLoading,
    error,
    editedContent,
    isSaving,
    terminalOutput,
    isExecuting,
    closeViewer,
    setContent,
    setLoading,
    setError,
    setMode,
    setEditedContent,
    setSaving,
    appendTerminalOutput,
    clearTerminal,
    setExecuting
  } = useFileViewerStore();

  const terminalRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext);
  const isHtml = ext === 'html' || ext === 'htm';
  const isExecutable = ['sh', 'py', 'js', 'bash'].includes(ext);
  const isEditable = !isImage;

  // 加载文件内容
  useEffect(() => {
    if (!isOpen || !filePath || mode === 'execute') return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await readFile(filePath);
        setContent(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      }
    };

    load();
  }, [isOpen, filePath, mode, setContent, setLoading, setError]);

  // 执行文件
  useEffect(() => {
    if (!isOpen || mode !== 'execute' || !filePath) return;

    const execute = async () => {
      clearTerminal();
      setExecuting(true);
      abortRef.current = new AbortController();

      try {
        const stream = await executeFile(filePath);
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          appendTerminalOutput(text);
        }
      } catch (err) {
        appendTerminalOutput(`\nError: ${err instanceof Error ? err.message : 'Execution failed'}`);
      } finally {
        setExecuting(false);
      }
    };

    execute();

    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, mode, filePath, clearTerminal, setExecuting, appendTerminalOutput]);

  // 自动滚动终端
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // 语法高亮
  useEffect(() => {
    if (mode === 'view' && content && !isImage && !isHtml) {
      Prism.highlightAll();
    }
  }, [content, mode, isImage, isHtml]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await writeFile(filePath, editedContent);
      setContent(editedContent);
      setMode('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const getLanguage = () => {
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      sh: 'bash',
      bash: 'bash',
      json: 'json',
      md: 'markdown',
      css: 'css'
    };
    return langMap[ext] || 'text';
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.content}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.title}>
            <span>{fileName}</span>
            <span className={styles.type}>{mode.toUpperCase()}</span>
          </div>
          <div className={styles.actions}>
            {mode === 'view' && isExecutable && (
              <button className={styles.btnExecute} onClick={() => setMode('execute')}>
                ▶ Execute
              </button>
            )}
            {mode === 'view' && isEditable && (
              <button className={styles.btnEdit} onClick={() => setMode('edit')}>
                ✎ Edit
              </button>
            )}
            <button className={styles.btnClose} onClick={closeViewer}>✕</button>
          </div>
        </div>

        {/* 内容区 */}
        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : mode === 'edit' ? (
            <textarea
              className={styles.editor}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              spellCheck={false}
            />
          ) : mode === 'execute' ? (
            <div className={styles.terminal} ref={terminalRef}>
              <pre>{terminalOutput}</pre>
              {isExecuting && <span className={styles.cursor}>▊</span>}
            </div>
          ) : isImage ? (
            <img src={getRawFileUrl(filePath)} alt={fileName} className={styles.image} />
          ) : isHtml ? (
            <iframe
              src={getRawFileUrl(filePath)}
              title={fileName}
              className={styles.iframe}
              sandbox="allow-scripts"
            />
          ) : (
            <pre className={`${styles.code} language-${getLanguage()}`}>
              <code>{content}</code>
            </pre>
          )}
        </div>

        {/* 底部操作 */}
        {mode === 'edit' && (
          <div className={styles.footer}>
            <button className={styles.btnSecondary} onClick={() => setMode('view')}>
              Cancel
            </button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        {mode === 'execute' && (
          <div className={styles.footer}>
            <button className={styles.btnSecondary} onClick={clearTerminal}>
              Clear
            </button>
            <button
              className={styles.btnDanger}
              onClick={() => abortRef.current?.abort()}
              disabled={!isExecuting}
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
