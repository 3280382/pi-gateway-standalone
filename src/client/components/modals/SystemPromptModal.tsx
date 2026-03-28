/**
 * SystemPromptModal - 系统提示查看器
 */

import { useEffect, useState } from 'react';
import { useModalStore } from '../../store/modalStore';
import styles from './Modals.module.css';

interface SystemPromptData {
  systemPrompt?: string;
  appendSystemPrompt?: string[];
  skills?: Array<{ name: string; content: string }>;
  agentsMd?: string;
}

export function SystemPromptModal() {
  const { isSystemPromptOpen, closeSystemPrompt } = useModalStore();
  const [data, setData] = useState<SystemPromptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'agents' | 'skills'>('prompt');

  useEffect(() => {
    if (!isSystemPromptOpen) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/system-prompt');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load system prompt:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isSystemPromptOpen]);

  if (!isSystemPromptOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeSystemPrompt}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>System Prompt & AGENTS.md</h3>
          <button className={styles.closeBtn} onClick={closeSystemPrompt}>✕</button>
        </div>

        <div className={styles.tabs}>
          <button
            className={activeTab === 'prompt' ? styles.activeTab : ''}
            onClick={() => setActiveTab('prompt')}
          >
            System Prompt
          </button>
          <button
            className={activeTab === 'agents' ? styles.activeTab : ''}
            onClick={() => setActiveTab('agents')}
          >
            AGENTS.md
          </button>
          <button
            className={activeTab === 'skills' ? styles.activeTab : ''}
            onClick={() => setActiveTab('skills')}
          >
            Skills ({data?.skills?.length || 0})
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : activeTab === 'prompt' ? (
            <div className={styles.promptSection}>
              <h4>⚙️ System Prompt</h4>
              <pre className={styles.code}>{data?.systemPrompt || 'No system prompt loaded'}</pre>
              {data?.appendSystemPrompt && data.appendSystemPrompt.length > 0 && (
                <>
                  <h4>➕ Append System Prompt ({data.appendSystemPrompt.length})</h4>
                  {data.appendSystemPrompt.map((prompt, i) => (
                    <pre key={i} className={styles.code}>{prompt}</pre>
                  ))}
                </>
              )}
            </div>
          ) : activeTab === 'agents' ? (
            <div className={styles.promptSection}>
              <h4>📄 AGENTS.md</h4>
              <pre className={styles.code}>{data?.agentsMd || 'No AGENTS.md loaded'}</pre>
            </div>
          ) : (
            <div className={styles.skillsList}>
              {data?.skills?.map((skill, i) => (
                <details key={i} className={styles.skillItem}>
                  <summary>{skill.name}</summary>
                  <pre className={styles.code}>{skill.content}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
