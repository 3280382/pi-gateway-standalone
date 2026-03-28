/**
 * ThinkingLevelModal - 思考级别选择器
 */

import { useModalStore } from '../../store/modalStore';
import { useSessionStore } from '../../store/sessionStore';
import styles from './Modals.module.css';

const THINKING_LEVELS = [
  { id: 'off', name: 'Off', description: 'No thinking output' },
  { id: 'minimal', name: 'Minimal', description: 'Brief thinking summaries' },
  { id: 'low', name: 'Low', description: 'Concise reasoning steps' },
  { id: 'medium', name: 'Medium', description: 'Standard thinking depth' },
  { id: 'high', name: 'High', description: 'Detailed reasoning' },
  { id: 'xhigh', name: 'X-High', description: 'Maximum thinking depth' }
];

export function ThinkingLevelModal() {
  const { isThinkingLevelOpen, closeThinkingLevel } = useModalStore();
  const { thinkingLevel, setThinkingLevel } = useSessionStore();

  const handleSelect = (level: string) => {
    setThinkingLevel(level as any);
    closeThinkingLevel();
  };

  if (!isThinkingLevelOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeThinkingLevel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Select Thinking Level</h3>
          <button className={styles.closeBtn} onClick={closeThinkingLevel}>✕</button>
        </div>

        <div className={styles.content}>
          <div className={styles.modelList}>
            {THINKING_LEVELS.map(level => (
              <div
                key={level.id}
                className={`${styles.modelItem} ${thinkingLevel === level.id ? styles.selected : ''}`}
                onClick={() => handleSelect(level.id)}
                data-level={level.id}
              >
                <div className={styles.levelInfo}>
                  <span className={styles.modelName}>{level.name}</span>
                  <span className={styles.levelDesc}>{level.description}</span>
                </div>
                {thinkingLevel === level.id && <span className={styles.checkmark}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
